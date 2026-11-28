import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase id');
const sourceId = z.string().regex(/^r\d+$/, 'source id like r12');

export const CAMERAS = ['lateral', 'front', 'knee', 'hip'] as const;
export const cameraSchema = z.enum(CAMERAS);
export const runModeSchema = z.enum(['manual', 'flat', 'down', 'fast']);

export const sourceSchema = z.object({
  id: sourceId,
  citation: z.string().min(10),
  url: z.url(),
});
export type Source = z.infer<typeof sourceSchema>;

/**
 * What one source can and cannot carry (ADR 0012, item 5), in
 * content/evidence/<source id>.json. For the people who check claims, not for
 * readers: the web bundle skips these files and the content hash ignores them.
 * `checked` is the maintainer's word that they read the source against the
 * note; the guard hook keeps agents from setting it.
 */
export const evidenceNoteSchema = z
  .object({
    source: sourceId,
    studyType: z.string().min(3),
    supports: z.array(z.string().min(5)).min(1),
    doesNotSupport: z.array(z.string().min(5)),
    limits: z.array(z.string().min(5)),
    checked: z.boolean(),
  })
  .strict();
export type EvidenceNote = z.infer<typeof evidenceNoteSchema>;

export const sceneHintSchema = z
  .object({
    structure: id.optional(),
    camera: cameraSchema.optional(),
    kneeAngle: z.number().min(0).max(90).optional(),
    hipDrop: z.number().min(0).max(10).optional(),
  })
  .strict();

export const termSchema = z
  .object({
    id,
    vi: z.string().min(2),
    en: z.string().min(2),
    category: z.enum(['structure', 'muscle', 'bone', 'concept', 'test']),
    short: z.string().min(10),
    /** Markdown. Source references are written as [^r12]. */
    body: z.string().min(10),
    related: z.array(id),
    injuries: z.record(
      id,
      z.object({ role: z.string().min(5), scene: sceneHintSchema.optional() }).strict(),
    ),
  })
  .strict();
export type Term = z.infer<typeof termSchema>;

export const reviewStampSchema = z
  .object({
    reviewerName: z.string().min(2),
    reviewerTitle: z.string().min(2),
    reviewedAt: z.iso.date(),
    /** sha256 of the reviewed content (see contentHash in load.ts). */
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const injurySchema = z
  .object({
    slug: id,
    title: z.object({ vi: z.string().min(2), en: z.string().min(2) }).strict(),
    region: z.string().min(2),
    /** draft: private work. published: publicly visible, requires `review`. */
    status: z.enum(['draft', 'published']),
    review: reviewStampSchema.nullable(),
    summary: z.string().min(20),
    summarySources: z.array(sourceId).min(1),
    anatomyModel: id,
    structures: z.array(z.string().min(1)).min(1),
    featuredTerms: z.array(id),
    updatedAt: z.iso.date(),
  })
  .strict();
export type Injury = z.infer<typeof injurySchema>;

export const rehabSchema = z
  .object({
    painRule: z.object({ acceptableMax: z.number().int().min(0).max(10), source: sourceId }),
    phases: z
      .array(
        z
          .object({
            id,
            label: z.string(),
            title: z.string(),
            focus: z.string(),
            goal: z.string().min(10),
            do: z.array(z.string()).min(1),
            avoid: z.array(z.string()),
            /** Criterion to move on. Rehab progresses by criteria, never by dates. */
            gate: z.string().min(5),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type Rehab = z.infer<typeof rehabSchema>;

export const mythsSchema = z.array(
  z.object({ id, myth: z.string().min(5), fact: z.string().min(20) }).strict(),
);
export type Myths = z.infer<typeof mythsSchema>;

const tourActionSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('tween'),
      param: z.enum(['kneeAngle', 'hipDrop']),
      to: z.number(),
      ms: z.number().int().positive(),
    })
    .strict(),
  z.object({ type: z.literal('highlight'), structure: id }).strict(),
]);

export const tourSchema = z
  .object({
    locale: z.string().min(2),
    steps: z
      .array(
        z
          .object({
            id,
            title: z.string().min(2),
            enter: z
              .object({
                camera: cameraSchema.optional(),
                mode: runModeSchema.optional(),
                kneeAngle: z.number().min(0).max(90).optional(),
                hipDrop: z.number().min(0).max(10).optional(),
                highlight: id.nullable().optional(),
                showTension: z.boolean().optional(),
              })
              .strict(),
            lines: z
              .array(
                z
                  .object({
                    id,
                    text: z.string().min(5),
                    actions: z.array(tourActionSchema).optional(),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type Tour = z.infer<typeof tourSchema>;

const keyframe = z.object({ phase: z.number().min(0).max(1), deg: z.number() }).strict();
export const simulationSchema = z
  .object({
    note: z.string(),
    sources: z.array(sourceId).min(1),
    impingementZone: z.object({ minDeg: z.number(), maxDeg: z.number() }).strict(),
    compression: z
      .object({
        peakDeg: z.number(),
        widthDeg: z.number().positive(),
        baseline: z.number().min(0).max(1),
        hipDropGain: z.number().min(0).max(1),
        hipDropMaxDeg: z.number().positive(),
      })
      .strict(),
    gait: z.record(
      z.enum(['flat', 'down', 'fast']),
      z
        .object({
          stanceEnd: z.number().min(0).max(1),
          keyframes: z.array(keyframe).min(2),
          /** What the reader should notice in this mode. Cites its sources. */
          explanation: z.string().min(20),
        })
        .strict(),
    ),
  })
  .strict();
export type Simulation = z.infer<typeof simulationSchema>;

const heading = z.string().min(2);
/** A sentence that makes a medical claim. Validation requires a [^rN] in it. */
const claim = z.string().min(10);

/** The long-form sections of an injury page: mechanism, causes, symptoms, clinical tests. */
export const sectionsSchema = z
  .object({
    mechanism: z
      .object({
        title: heading,
        /** Optional while it waits for a source. */
        intro: claim.optional(),
        /** The friction hypothesis the evidence replaced. Optional while it waits for a source. */
        oldHypothesis: z
          .object({ label: heading, title: heading, text: claim })
          .strict()
          .optional(),
        evidence: z
          .object({ label: heading, title: heading, points: z.array(claim).min(1) })
          .strict(),
        whyItMatters: z.object({ title: heading, text: claim }).strict(),
      })
      .strict(),
    causes: z
      .object({
        title: heading,
        intro: claim,
        items: z.array(z.object({ title: heading, text: claim }).strict()).min(1),
      })
      .strict(),
    symptoms: z
      .object({
        title: heading,
        typical: z.array(claim).min(1),
        /** May be empty while its claims wait for a source. */
        redFlags: z.array(claim),
        seeExpert: claim,
        differential: z.array(z.object({ condition: heading, difference: claim }).strict()),
      })
      .strict(),
    tests: z
      .object({
        title: heading,
        intro: claim,
        items: z
          .array(
            z
              .object({
                id,
                name: heading,
                en: heading,
                text: claim,
                /** "Xem góc …° trên 3D": open this term with the knee at this angle. */
                scene: z
                  .object({ term: id, kneeAngle: z.number().min(0).max(90) })
                  .strict()
                  .optional(),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
  })
  .strict();
export type Sections = z.infer<typeof sectionsSchema>;

/** Every claim in the sections with where it sits, for the citation rules. */
export const sectionClaims = (s: Sections): [where: string, text: string][] => [
  ...(s.mechanism.intro ? [['mechanism.intro', s.mechanism.intro] as [string, string]] : []),
  ...(s.mechanism.oldHypothesis
    ? [['mechanism.oldHypothesis.text', s.mechanism.oldHypothesis.text] as [string, string]]
    : []),
  ...s.mechanism.evidence.points.map((t, i): [string, string] => [
    `mechanism.evidence.points.${i}`,
    t,
  ]),
  ['mechanism.whyItMatters.text', s.mechanism.whyItMatters.text],
  ['causes.intro', s.causes.intro],
  ...s.causes.items.map((c, i): [string, string] => [`causes.items.${i}.text`, c.text]),
  ...s.symptoms.typical.map((t, i): [string, string] => [`symptoms.typical.${i}`, t]),
  ...s.symptoms.redFlags.map((t, i): [string, string] => [`symptoms.redFlags.${i}`, t]),
  ['symptoms.seeExpert', s.symptoms.seeExpert],
  ...s.symptoms.differential.map((d, i): [string, string] => [
    `symptoms.differential.${i}.difference`,
    d.difference,
  ]),
  ['tests.intro', s.tests.intro],
  ...s.tests.items.map((t, i): [string, string] => [`tests.items.${i}.text`, t.text]),
];

export interface InjuryBundle {
  injury: Injury;
  rehab: Rehab;
  myths: Myths;
  tour: Tour;
  simulation: Simulation;
  sections: Sections;
  /** sha256 over the injury's files and the terms it uses. */
  contentHash: string;
}

export interface Content {
  sources: Source[];
  evidence: EvidenceNote[];
  terms: Term[];
  injuries: InjuryBundle[];
}
