import { describe, expect, it } from 'vitest';
import { isValid } from './commit-msg.mjs';

describe('commit message check', () => {
  it('accepts conventional subjects', () => {
    for (const m of [
      'feat(web): add knee slider',
      'fix: handle empty tour',
      'content(itbs): cite Orchard 1996',
      'chore!: drop node 20',
    ]) {
      expect(isValid(m)).toBe(true);
    }
  });
  it('rejects everything else', () => {
    for (const m of [
      'update stuff',
      'feat add slider',
      'Feat: x',
      'wip',
      `feat: ${'x'.repeat(120)}`,
    ]) {
      expect(isValid(m)).toBe(false);
    }
  });
});
