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
      z.object({ stanceEnd: z.number().min(0).max(1), keyframes: z.array(keyframe).min(2) }),
    ),
  })
  .strict();
export type Simulation = z.infer<typeof simulationSchema>;

export interface InjuryBundle {
  injury: Injury;
  rehab: Rehab;
  myths: Myths;
  tour: Tour;
  simulation: Simulation;
  /** sha256 over the injury's files and the terms it uses. */
  contentHash: string;
}

export interface Content {
  sources: Source[];
  terms: Term[];
  injuries: InjuryBundle[];
}
