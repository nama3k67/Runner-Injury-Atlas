import { describe, expect, it } from 'vitest';
import { LABELS, labelShown } from './labels';

describe('labelShown', () => {
  it('shows detail labels only up close and the big structures only from afar (v0.3)', () => {
    expect(labelShown(true, 60, true)).toBe(true);
    expect(labelShown(true, 90, true)).toBe(false);
    expect(labelShown(false, 60, true)).toBe(true);
    expect(labelShown(false, 30, true)).toBe(false);
  });

  it('hides every label when labels are switched off', () => {
    expect(labelShown(true, 60, false)).toBe(false);
    expect(labelShown(false, 60, false)).toBe(false);
  });
});

describe('LABELS', () => {
  it('has the nine v0.3 labels, with the four landmarks marked as detail', () => {
    expect(Object.keys(LABELS)).toHaveLength(9);
    const near = Object.entries(LABELS)
      .filter(([, l]) => l.near)
      .map(([id]) => id)
      .sort();
    expect(near).toEqual(['fatpad', 'gerdy', 'kaplan', 'lfe']);
  });
});
