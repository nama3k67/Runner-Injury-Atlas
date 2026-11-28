import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent, readContentFiles, readNarration } from './load';
import { ContentParseError, parseContent, stableStringify } from './parse';
import { type NarrationManifest, narrationManifestSchema } from './schemas';
import { sourceRefs, textSha256, validateContent, validateNarration } from './validate';

const ROOT = resolve(__dirname, '../../../content');
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('repository content', () => {
  it('parses and passes every cross-file rule', () => {
    const report = validateContent(loadContent(ROOT));
    expect(report.errors).toEqual([]);
  });

  it('cites every source somewhere in structured content', () => {
    const report = validateContent(loadContent(ROOT));
    expect(report.warnings.filter((w) => w.message.includes('never cited'))).toEqual([]);
  });

  it('has a stable content hash that ignores workflow fields', () => {
    const files = readContentFiles(ROOT);
    const before = parseContent(files).injuries[0]?.contentHash;
    const edited = clone(files) as Record<string, Record<string, unknown>>;
    const injury = edited['injuries/itbs/injury.json'];
    if (!injury) throw new Error('fixture missing');
    injury.updatedAt = '2030-01-01';
    expect(parseContent(edited).injuries[0]?.contentHash).toBe(before);
    injury.summary = `${String(injury.summary)} Thêm một câu.`;
    expect(parseContent(edited).injuries[0]?.contentHash).not.toBe(before);
  });
});

describe('medical content gate', () => {
  it('rejects a citation of a source that does not exist', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, Record<string, unknown>>;
    const term = files['terms/itb.json'];
    if (!term) throw new Error('fixture missing');
    term.body = `${String(term.body)} Một nhận định mới[^r999].`;
    const { errors } = validateContent(parseContent(files));
    expect(errors.some((e) => e.message.includes('[^r999]'))).toBe(true);
  });

  it('refuses "published" without a review stamp', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, Record<string, unknown>>;
    const injury = files['injuries/itbs/injury.json'];
    if (!injury) throw new Error('fixture missing');
    injury.status = 'published';
    const { errors } = validateContent(parseContent(files));
    expect(errors.some((e) => e.message.includes('review stamp'))).toBe(true);
  });

  it('refuses a review stamp that covers older content', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, Record<string, unknown>>;
    const injury = files['injuries/itbs/injury.json'];
    if (!injury) throw new Error('fixture missing');
    injury.status = 'published';
    injury.review = {
      reviewerName: 'Nguyễn Văn A',
      reviewerTitle: 'Chuyên viên vật lý trị liệu',
      reviewedAt: '2026-12-01',
      contentHash: 'a'.repeat(64),
    };
    const { errors } = validateContent(parseContent(files));
    expect(errors.some((e) => e.message.includes('content changed after review'))).toBe(true);
  });

  it('accepts "published" when the stamp matches the current content', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, Record<string, unknown>>;
    const injury = files['injuries/itbs/injury.json'];
    const hash = parseContent(files).injuries[0]?.contentHash;
    if (!injury || !hash) throw new Error('fixture missing');
    injury.status = 'published';
    injury.review = {
      reviewerName: 'Nguyễn Văn A',
      reviewerTitle: 'Chuyên viên vật lý trị liệu',
      reviewedAt: '2026-12-01',
      contentHash: hash,
    };
    expect(validateContent(parseContent(files)).errors).toEqual([]);
  });

  it('requires every myth "fact" to cite a source', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, unknown>;
    const myths = files['injuries/itbs/myths.json'] as { fact: string }[];
    if (!myths[0]) throw new Error('fixture missing');
    myths[0].fact = 'Một khẳng định dài nhưng không có nguồn nào cả.';
    const { errors } = validateContent(parseContent(files));
    expect(errors.some((e) => e.message.includes('must cite a source'))).toBe(true);
  });

  it('requires every claim in the long-form sections to cite a source', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, unknown>;
    const sections = files['injuries/itbs/sections.json'] as {
      symptoms: { typical: string[]; differential: { difference: string }[] };
    };
    sections.symptoms.typical[0] = 'Một dấu hiệu dài nhưng không có nguồn nào cả.';
    const row = sections.symptoms.differential[0];
    if (!row) throw new Error('fixture missing');
    row.difference = 'Một điểm khác dài nhưng không có nguồn nào cả.';
    const { errors } = validateContent(parseContent(files));
    const messages = errors.map((e) => e.message);
    expect(messages).toContain('symptoms.typical.0: must cite a source');
    expect(messages).toContain('symptoms.differential.0.difference: must cite a source');
  });

  it('checks that a clinical test points at a known term', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, unknown>;
    const sections = files['injuries/itbs/sections.json'] as {
      tests: { items: { scene?: { term: string } }[] };
    };
    const withScene = sections.tests.items.find((t) => t.scene);
    if (!withScene?.scene) throw new Error('fixture missing');
    withScene.scene.term = 'no-such-term';
    const { errors } = validateContent(parseContent(files));
    expect(errors.some((e) => e.message.includes('unknown term "no-such-term"'))).toBe(true);
  });

  it('requires every run mode explanation to cite a source', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, unknown>;
    const sim = files['injuries/itbs/simulation.json'] as {
      gait: Record<string, { explanation: string }>;
    };
    if (!sim.gait.down) throw new Error('fixture missing');
    sim.gait.down.explanation = 'Một giải thích dài nhưng không có nguồn nào cả.';
    const { errors } = validateContent(parseContent(files));
    expect(errors.some((e) => e.message === 'gait.down.explanation: must cite a source')).toBe(
      true,
    );
  });
});

describe('evidence notes', () => {
  const note = (source: string) => ({
    source,
    studyType: 'Nghiên cứu giải phẫu trên tử thi',
    supports: ['Dải chậu chày bám vào lồi cầu ngoài xương đùi.'],
    doesNotSupport: ['Kết quả điều trị trên người chạy.'],
    limits: ['Mẫu nhỏ.'],
    checked: false,
  });

  it('warns about a source without a note, and not about one with a note', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, unknown>;
    files['evidence/r1.json'] = note('r1');
    const { errors, warnings } = validateContent(parseContent(files));
    expect(errors).toEqual([]);
    const missing = warnings.filter((w) => w.message.includes('no evidence note'));
    expect(missing.some((w) => w.message.startsWith('r1 '))).toBe(false);
    expect(missing.some((w) => w.message.startsWith('r2 '))).toBe(true);
  });

  it('rejects a note for a source that does not exist', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, unknown>;
    files['evidence/r999.json'] = note('r999');
    const { errors } = validateContent(parseContent(files));
    expect(errors).toContainEqual({
      file: 'evidence/r999.json',
      message: 'note for unknown source "r999"',
    });
  });

  it('requires the note to be named after its source', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, unknown>;
    files['evidence/r2.json'] = note('r1');
    expect(() => parseContent(files)).toThrow(/must match the file name/);
  });

  it('keeps notes out of the content hash', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, unknown>;
    const before = parseContent(files).injuries[0]?.contentHash;
    files['evidence/r1.json'] = note('r1');
    expect(parseContent(files).injuries[0]?.contentHash).toBe(before);
  });
});

describe('schema errors', () => {
  it('reports unknown fields and bad values with their file', () => {
    const files = clone(readContentFiles(ROOT)) as Record<string, Record<string, unknown>>;
    const term = files['terms/itb.json'];
    if (!term) throw new Error('fixture missing');
    term.category = 'ligament';
    term.surprise = true;
    try {
      parseContent(files);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ContentParseError);
      const files = (err as ContentParseError).issues.map((i) => i.file);
      expect(new Set(files)).toEqual(new Set(['terms/itb.json']));
    }
  });
});

describe('helpers', () => {
  it('stableStringify ignores key order', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(
      stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }),
    );
  });
  it('sourceRefs finds every reference', () => {
    expect(sourceRefs('a[^r1] b[^r12][^r3]')).toEqual(['r1', 'r12', 'r3']);
  });
});

describe('narration (ADR 0014)', () => {
  const tour = loadContent(ROOT).injuries[0]?.tour;
  if (!tour) throw new Error('no tour in repository content');
  const lines = tour.steps.flatMap((s) => s.lines);
  const FILE = 'narration/itbs/manifest.json';

  /** A manifest and file list that match the tour, for one voice. */
  const upToDate = () => {
    const manifest: NarrationManifest = {
      voices: {
        'ngoc-huyen': {
          label: 'Ngọc Huyền (nữ, giọng Bắc)',
          lines: Object.fromEntries(
            lines.map((l) => [l.id, { textSha256: textSha256(l.text), settings: { preset: 'x' } }]),
          ),
        },
      },
    };
    return { manifest, files: lines.map((l) => `ngoc-huyen/${l.id}.ogg`) };
  };

  it('hashes text the same way as tools/narration (UTF-8, no normalisation)', () => {
    expect(textSha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    // From Python: hashlib.sha256(text.encode()).hexdigest()
    expect(textSha256('Chào bạn. Đây là mô hình chân phải, nhìn từ mặt ngoài.')).toBe(
      '0ce4f07c2cebaadd63c9832cae069e49c7b8e714933dfbdbd35a7bbc2276b12f',
    );
  });

  it('passes when every line of every voice matches', () => {
    const { manifest, files } = upToDate();
    expect(validateNarration(tour, manifest, files, FILE)).toEqual([]);
  });

  it('fails when a line text no longer matches its hash, naming voice and line', () => {
    const { manifest, files } = upToDate();
    const edited = clone(tour);
    const first = edited.steps[0]?.lines[0];
    if (!first) throw new Error('empty tour');
    first.text += ' Thêm.';
    expect(validateNarration(edited, manifest, files, FILE)).toEqual([
      { file: FILE, message: `ngoc-huyen/${first.id}: text changed since its audio was generated` },
    ]);
  });

  it('fails when a voice has no file or no manifest entry for a line', () => {
    const { manifest, files } = upToDate();
    const [a, b] = lines;
    if (!a || !b) throw new Error('tour too short');
    delete manifest.voices['ngoc-huyen']?.lines[b.id];
    const issues = validateNarration(
      tour,
      manifest,
      files.filter((f) => f !== `ngoc-huyen/${a.id}.ogg`),
      FILE,
    );
    expect(issues).toEqual([
      { file: FILE, message: `ngoc-huyen/${a.id}: no audio file` },
      { file: FILE, message: `ngoc-huyen/${b.id}: not in the manifest` },
    ]);
  });

  it('fails when a file or manifest entry has no line in the tour', () => {
    const { manifest, files } = upToDate();
    const voice = manifest.voices['ngoc-huyen'];
    if (!voice) throw new Error('no voice');
    voice.lines['s99-l1'] = { textSha256: textSha256('gone'), settings: {} };
    const issues = validateNarration(tour, manifest, [...files, 'ngoc-huyen/s99-l2.ogg'], FILE);
    expect(issues).toEqual([
      { file: FILE, message: 'ngoc-huyen/s99-l1: no such line in tour.json' },
      { file: FILE, message: 'ngoc-huyen/s99-l2: no such line in tour.json' },
    ]);
  });

  it('fails when a file belongs to a voice the manifest does not list', () => {
    const { manifest, files } = upToDate();
    const [a] = lines;
    if (!a) throw new Error('empty tour');
    expect(validateNarration(tour, manifest, [...files, `truc-ly/${a.id}.ogg`], FILE)).toEqual([
      { file: FILE, message: `truc-ly/${a.id}: voice is not in the manifest` },
    ]);
  });

  it('rejects a malformed manifest', () => {
    expect(
      narrationManifestSchema.safeParse({ voices: { x: { label: 'X', lines: { a: {} } } } })
        .success,
    ).toBe(false);
  });

  it('reads a manifest and its files from disk, and nothing when there is no manifest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'narration-'));
    expect(readNarration(dir)).toBeUndefined();
    const { manifest } = upToDate();
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
    mkdirSync(join(dir, 'ngoc-huyen'));
    writeFileSync(join(dir, 'ngoc-huyen', 's1-l1.ogg'), '');
    writeFileSync(join(dir, 'ngoc-huyen', 'notes.txt'), '');
    expect(readNarration(dir)).toEqual({ manifest, files: ['ngoc-huyen/s1-l1.ogg'] });
  });
});
