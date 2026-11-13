import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Anonymous feedback about CONTENT. By design there is no user table and no
 * column that can hold contact details or health data (ADR 0008).
 */
export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    injurySlug: text('injury_slug').notNull(),
    target: text('target'),
    kind: text('kind', { enum: ['error', 'unclear', 'suggestion'] }).notNull(),
    message: text('message').notNull(),
    status: text('status', { enum: ['open', 'resolved'] })
      .notNull()
      .default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('feedback_injury_status_idx').on(t.injurySlug, t.status)],
);

/** One row per review round of one exact content hash. */
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    injurySlug: text('injury_slug').notNull(),
    contentHash: text('content_hash').notNull(),
    status: text('status', { enum: ['pending', 'approved', 'changes_requested'] })
      .notNull()
      .default('pending'),
    reviewerName: text('reviewer_name'),
    reviewerTitle: text('reviewer_title'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [index('reviews_slug_hash_idx').on(t.injurySlug, t.contentHash)],
);

export const schema = { feedback, reviews };
