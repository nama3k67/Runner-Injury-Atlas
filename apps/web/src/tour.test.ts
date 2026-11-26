import type { Tour } from '@atlas/content-schema';
import { describe, expect, it } from 'vitest';
import { afterLine, pickVietnameseVoice, previousStep, readingMs, tweenAt } from './tour';

const line = (id: string) => ({ id, text: 'Một câu đọc.' });
const tour: Tour = {
  locale: 'vi',
  steps: [
    { id: 'a', title: 'A', enter: {}, lines: [line('a1'), line('a2')] },
    { id: 'b', title: 'B', enter: {}, lines: [line('b1')] },
  ],
};

describe('afterLine', () => {
  it('moves to the next line, then the next step, then ends', () => {
    expect(afterLine(tour, { step: 0, line: 0 })).toEqual({ step: 0, line: 1 });
    expect(afterLine(tour, { step: 0, line: 1 })).toEqual({ step: 1, line: 0 });
    expect(afterLine(tour, { step: 1, line: 0 })).toBe('end');
  });
});

describe('previousStep', () => {
  it('restarts the current step after its first line, else goes back one step, never below 0', () => {
    expect(previousStep({ step: 1, line: 2 })).toBe(1);
    expect(previousStep({ step: 1, line: 0 })).toBe(0);
    expect(previousStep({ step: 0, line: 0 })).toBe(0);
  });
});

describe('pickVietnameseVoice', () => {
  const v = (lang: string, name: string) => ({ lang, name });
  it('prefers a natural or online Vietnamese voice, then any Vietnamese voice', () => {
    const plain = v('vi-VN', 'Linh');
    const google = v('vi-VN', 'Google Tiếng Việt');
    expect(pickVietnameseVoice([v('en-US', 'Google US'), plain, google])).toBe(google);
    expect(pickVietnameseVoice([v('en-US', 'Alex'), plain])).toBe(plain);
    expect(pickVietnameseVoice([v('vi_VN', 'X')])).toEqual(v('vi_VN', 'X'));
  });
  it('returns null without a Vietnamese voice', () => {
    expect(pickVietnameseVoice([v('en-US', 'Alex'), v('vie', 'not a BCP 47 tag')])).toBeNull();
    expect(pickVietnameseVoice([])).toBeNull();
  });
});

describe('readingMs', () => {
  it('grows with the text and never drops below 2.2 s', () => {
    expect(readingMs('ngắn')).toBe(2200);
    expect(readingMs('x'.repeat(100))).toBe(6800);
  });
});

describe('tweenAt', () => {
  const tw = { from: 0, to: 30, t0: 1000, ms: 1000 };
  it('eases from start to end and clamps outside the window', () => {
    expect(tweenAt(tw, 500)).toEqual({ value: 0, done: false });
    expect(tweenAt(tw, 1500).value).toBeCloseTo(15);
    expect(tweenAt(tw, 1500).done).toBe(false);
    expect(tweenAt(tw, 2000)).toEqual({ value: 30, done: true });
    expect(tweenAt(tw, 9000)).toEqual({ value: 30, done: true });
  });
});
