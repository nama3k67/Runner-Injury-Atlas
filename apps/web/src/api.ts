import {
  type CreateFeedback,
  type Feedback,
  feedbackSchema,
  type ReviewBadge,
  reviewBadgeSchema,
} from '@atlas/contracts';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new ApiError(res.status, `API ${res.status} on ${path}`);
  return res.json();
}

// Responses are parsed with the shared contracts: a backend that drifts from
// the contract fails loudly here instead of rendering wrong data.
export const sendFeedback = async (body: CreateFeedback): Promise<Feedback> =>
  feedbackSchema.parse(await call('/feedback', { method: 'POST', body: JSON.stringify(body) }));

export const getReviewBadge = async (
  injurySlug: string,
  contentHash: string,
): Promise<ReviewBadge> =>
  reviewBadgeSchema.parse(
    await call(`/reviews/badge?injurySlug=${injurySlug}&contentHash=${contentHash}`),
  );
