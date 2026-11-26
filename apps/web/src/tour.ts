import type { Tour } from '@atlas/content-schema';

// Pure tour logic, ported from legacy v0.3 (runStep, advance, pickVoice, stepTweens).

export interface TourCursor {
  step: number;
  line: number;
}

/** Where the tour goes after a line finishes. */
export const afterLine = (tour: Tour, c: TourCursor): TourCursor | 'end' => {
  const lines = tour.steps[c.step]?.lines.length ?? 0;
  if (c.line + 1 < lines) return { step: c.step, line: c.line + 1 };
  if (c.step + 1 < tour.steps.length) return { step: c.step + 1, line: 0 };
  return 'end';
};

/** "Previous" restarts the current step once it has moved past its first line (v0.3). */
export const previousStep = (c: TourCursor): number =>
  c.line > 0 ? c.step : Math.max(0, c.step - 1);

interface Voice {
  lang: string;
  name: string;
}

/** A Vietnamese voice, preferring the better-sounding network ones. */
export const pickVietnameseVoice = <V extends Voice>(voices: readonly V[]): V | null => {
  const vi = voices.filter((v) => /^vi([-_]|$)/i.test(v.lang));
  return vi.find((v) => /google|natural|online/i.test(v.name)) ?? vi[0] ?? null;
};

/** How long a caption stays up when no voice reads it. */
export const readingMs = (text: string): number => Math.max(2200, text.length * 68);

export interface Tween {
  from: number;
  to: number;
  t0: number;
  ms: number;
}

/** Cosine ease-in-out, as v0.3. */
export const tweenAt = (tw: Tween, now: number): { value: number; done: boolean } => {
  const t = Math.min(1, Math.max(0, (now - tw.t0) / tw.ms));
  const e = (1 - Math.cos(Math.PI * t)) / 2;
  return { value: tw.from + (tw.to - tw.from) * e, done: t >= 1 };
};
