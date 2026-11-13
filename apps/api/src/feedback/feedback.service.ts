import type { CreateFeedback, Feedback } from '@atlas/contracts';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db';
import { feedback } from '../db/schema';

type Row = typeof feedback.$inferSelect;

const toDto = (row: Row): Feedback => ({
  id: row.id,
  injurySlug: row.injurySlug,
  ...(row.target ? { target: row.target } : {}),
  kind: row.kind,
  message: row.message,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class FeedbackService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(input: CreateFeedback): Promise<Feedback> {
    const [row] = await this.db
      .insert(feedback)
      .values({
        injurySlug: input.injurySlug,
        target: input.target ?? null,
        kind: input.kind,
        message: input.message,
      })
      .returning();
    if (!row) throw new Error('insert returned no row');
    return toDto(row);
  }

  async list(filter: { injurySlug?: string; status?: Feedback['status'] }): Promise<Feedback[]> {
    const rows = await this.db
      .select()
      .from(feedback)
      .where(
        and(
          filter.injurySlug ? eq(feedback.injurySlug, filter.injurySlug) : undefined,
          filter.status ? eq(feedback.status, filter.status) : undefined,
        ),
      )
      .orderBy(desc(feedback.createdAt))
      .limit(200);
    return rows.map(toDto);
  }

  async resolve(id: string): Promise<Feedback> {
    const [row] = await this.db
      .update(feedback)
      .set({ status: 'resolved' })
      .where(eq(feedback.id, id))
      .returning();
    if (!row) throw new NotFoundException(`Feedback ${id} not found`);
    return toDto(row);
  }
}
