import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent, readContentFiles } from './load';
import { ContentParseError, parseContent, stableStringify } from './parse';
import { sourceRefs, validateContent } from './validate';

const ROOT = resolve(__dirname, '../../../content');
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('repository content', () => {
  it('parses and passes every cross-file rule', () => {
    const report = validateContent(loadContent(ROOT));
    expect(report.errors).toEqual([]);
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
