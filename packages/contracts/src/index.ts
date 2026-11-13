/**
 * API contracts shared by apps/api (validation) and apps/web (typed client).
 * One zod schema per request/response; types are inferred, never hand-written.
 *
 * Privacy rule (ADR 0008): no field here may carry health data about a user or
 * contact details. Feedback is anonymous and about the CONTENT, not the reader.
 */
import { z } from 'zod';

export const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase slug');

// ---------- feedback ----------
export const feedbackKindSchema = z.enum(['error', 'unclear', 'suggestion']);
export type FeedbackKind = z.infer<typeof feedbackKindSchema>;

export const createFeedbackSchema = z.object({
  injurySlug: slugSchema,
  /** Optional anchor inside the page: a term id, section id or tour line id. */
  target: z.string().min(1).max(80).optional(),
  kind: feedbackKindSchema,
  message: z.string().trim().min(10).max(2000),
});
export type CreateFeedback = z.infer<typeof createFeedbackSchema>;

export const feedbackSchema = createFeedbackSchema.extend({
  id: z.uuid(),
  status: z.enum(['open', 'resolved']),
  createdAt: z.iso.datetime(),
});
export type Feedback = z.infer<typeof feedbackSchema>;

// ---------- content review workflow ----------
export const reviewStatusSchema = z.enum(['pending', 'approved', 'changes_requested']);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const contentHashSchema = z.string().regex(/^[a-f0-9]{64}$/, 'sha256 hex');

export const requestReviewSchema = z.object({
  injurySlug: slugSchema,
  /** sha256 of the injury's content files; a review only covers this exact content. */
  contentHash: contentHashSchema,
});
export type RequestReview = z.infer<typeof requestReviewSchema>;

export const decideReviewSchema = z.object({
  verdict: z.enum(['approved', 'changes_requested']),
  reviewerName: z.string().trim().min(2).max(120),
  /** Professional title shown on the page, e.g. "Chuyên viên vật lý trị liệu". */
  reviewerTitle: z.string().trim().min(2).max(160),
  notes: z.string().trim().max(4000).optional(),
});
export type DecideReview = z.infer<typeof decideReviewSchema>;

export const reviewSchema = z.object({
  id: z.uuid(),
  injurySlug: slugSchema,
  contentHash: contentHashSchema,
  status: reviewStatusSchema,
  reviewerName: z.string().nullable(),
  reviewerTitle: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
});
export type Review = z.infer<typeof reviewSchema>;

/** Public answer to "is the content I am looking at reviewed?". */
export const reviewBadgeSchema = z.object({
  injurySlug: slugSchema,
  contentHash: contentHashSchema,
  reviewed: z.boolean(),
  reviewerName: z.string().nullable(),
  reviewerTitle: z.string().nullable(),
  decidedAt: z.iso.datetime().nullable(),
});
export type ReviewBadge = z.infer<typeof reviewBadgeSchema>;

export const healthSchema = z.object({
  status: z.literal('ok'),
  db: z.enum(['up', 'down']),
  version: z.string(),
});
export type Health = z.infer<typeof healthSchema>;
