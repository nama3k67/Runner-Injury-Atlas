import type { DecideReview, RequestReview, Review, ReviewBadge } from '@atlas/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db';
import { reviews } from '../db/schema';

type Row = typeof reviews.$inferSelect;

const toDto = (row: Row): Review => ({
  id: row.id,
  injurySlug: row.injurySlug,
  contentHash: row.contentHash,
  status: row.status,
  reviewerName: row.reviewerName,
  reviewerTitle: row.reviewerTitle,
  notes: row.notes,
  createdAt: row.createdAt.toISOString(),
  decidedAt: row.decidedAt?.toISOString() ?? null,
});

/**
 * Medical review workflow. A review is bound to one content hash: editing the
 * content produces a new hash, so an old approval never covers new text.
 *
 *   request -> pending -> approved | changes_requested   (terminal)
 */
@Injectable()
export class ReviewsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Idempotent: asking twice for the same content returns the open round. */
  async request(input: RequestReview): Promise<Review> {
    const [open] = await this.db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.injurySlug, input.injurySlug),
          eq(reviews.contentHash, input.contentHash),
          eq(reviews.status, 'pending'),
        ),
      )
      .limit(1);
    if (open) return toDto(open);
    const [row] = await this.db.insert(reviews).values(input).returning();
    if (!row) throw new Error('insert returned no row');
    return toDto(row);
  }

  async decide(id: string, input: DecideReview): Promise<Review> {
    const [row] = await this.db
      .update(reviews)
      .set({
        status: input.verdict,
        reviewerName: input.reviewerName,
        reviewerTitle: input.reviewerTitle,
        notes: input.notes ?? null,
        decidedAt: new Date(),
      })
      .where(and(eq(reviews.id, id), eq(reviews.status, 'pending')))
      .returning();
    if (row) return toDto(row);
    const [existing] = await this.db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    if (!existing) throw new NotFoundException(`Review ${id} not found`);
    throw new ConflictException(`Review ${id} is already ${existing.status}`);
  }

  async list(injurySlug?: string): Promise<Review[]> {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(injurySlug ? eq(reviews.injurySlug, injurySlug) : undefined)
      .orderBy(desc(reviews.createdAt))
      .limit(200);
    return rows.map(toDto);
  }

  /** What the public page shows: reviewed only if THIS content was approved. */
  async badge(injurySlug: string, contentHash: string): Promise<ReviewBadge> {
    const [approved] = await this.db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.injurySlug, injurySlug),
          eq(reviews.contentHash, contentHash),
          eq(reviews.status, 'approved'),
        ),
      )
      .orderBy(desc(reviews.decidedAt))
      .limit(1);
    return {
      injurySlug,
      contentHash,
      reviewed: Boolean(approved),
      reviewerName: approved?.reviewerName ?? null,
      reviewerTitle: approved?.reviewerTitle ?? null,
      decidedAt: approved?.decidedAt?.toISOString() ?? null,
    };
  }
}
