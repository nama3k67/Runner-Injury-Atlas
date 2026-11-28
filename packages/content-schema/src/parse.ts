import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { z } from 'zod';
import {
  type Content,
  type EvidenceNote,
  evidenceNoteSchema,
  type InjuryBundle,
  injurySchema,
  mythsSchema,
  rehabSchema,
  type Source,
  sectionsSchema,
  simulationSchema,
  sourceSchema,
  type Term,
  termSchema,
  tourSchema,
} from './schemas';

export interface Issue {
  file: string;
  message: string;
}

export class ContentParseError extends Error {
  constructor(public readonly issues: Issue[]) {
    super(
      `Content failed schema validation:\n${issues.map((i) => `  ${i.file}: ${i.message}`).join('\n')}`,
    );
  }
}

/** JSON.stringify with sorted object keys, so the hash ignores key order. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const INJURY_FILES = ['injury', 'rehab', 'myths', 'tour', 'simulation', 'sections'] as const;

/**
 * Build typed content from raw JSON keyed by path relative to the content root
 * ("sources.json", "terms/itb.json", "injuries/itbs/tour.json").
 * Environment-neutral: the Node loader and the Vite glob import both feed it.
 */
export function parseContent(files: Record<string, unknown>): Content {
  const issues: Issue[] = [];
  const parse = <T>(file: string, schema: z.ZodType<T>): T | undefined => {
    if (!(file in files)) {
      issues.push({ file, message: 'file is missing' });
      return undefined;
    }
    const result = schema.safeParse(files[file]);
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      issues.push({ file, message: `${issue.path.join('.') || '(root)'}: ${issue.message}` });
    }
    return undefined;
  };

  const sources: Source[] = parse('sources.json', z.array(sourceSchema)) ?? [];

  const evidence: EvidenceNote[] = [];
  for (const file of Object.keys(files).sort()) {
    const match = /^evidence\/([^/]+)\.json$/.exec(file);
    if (!match) continue;
    const note = parse(file, evidenceNoteSchema);
    if (!note) continue;
    if (note.source !== match[1])
      issues.push({ file, message: `source "${note.source}" must match the file name` });
    evidence.push(note);
  }

  const terms: Term[] = [];
  for (const file of Object.keys(files).sort()) {
    const match = /^terms\/([^/]+)\.json$/.exec(file);
    if (!match) continue;
    const term = parse(file, termSchema);
    if (!term) continue;
    if (term.id !== match[1])
      issues.push({ file, message: `id "${term.id}" must match the file name` });
    terms.push(term);
  }

  const slugs = new Set<string>();
  for (const file of Object.keys(files)) {
    const match = /^injuries\/([^/]+)\//.exec(file);
    if (match?.[1]) slugs.add(match[1]);
  }

  const injuries: InjuryBundle[] = [];
  for (const slug of [...slugs].sort()) {
    const dir = `injuries/${slug}`;
    const injury = parse(`${dir}/injury.json`, injurySchema);
    const rehab = parse(`${dir}/rehab.json`, rehabSchema);
    const myths = parse(`${dir}/myths.json`, mythsSchema);
    const tour = parse(`${dir}/tour.json`, tourSchema);
    const simulation = parse(`${dir}/simulation.json`, simulationSchema);
    const sections = parse(`${dir}/sections.json`, sectionsSchema);
    if (!injury || !rehab || !myths || !tour || !simulation || !sections) continue;
    if (injury.slug !== slug)
      issues.push({
        file: `${dir}/injury.json`,
        message: `slug "${injury.slug}" must match folder`,
      });
    // The hash covers what a reviewer signs off: everything except the
    // workflow fields (status, review stamp, updatedAt).
    const { status: _s, review: _r, updatedAt: _u, ...reviewable } = injury;
    const contentHash = bytesToHex(
      sha256(
        utf8ToBytes(
          stableStringify({
            injury: reviewable,
            rehab,
            myths,
            tour,
            simulation,
            sections,
            terms: terms.filter((t) => slug in t.injuries),
            sources,
          }),
        ),
      ),
    );
    injuries.push({ injury, rehab, myths, tour, simulation, sections, contentHash });
  }

  if (issues.length > 0) throw new ContentParseError(issues);
  return { sources, evidence, terms, injuries };
}

export const INJURY_FILE_NAMES: readonly string[] = INJURY_FILES.map((f) => `${f}.json`);
