import { describe, expect, it } from 'vitest';
import {
  type CompressionParams,
  compression,
  type GaitKeyframe,
  gaitAngle,
  inZone,
  smoothstep,
  softTissueWeights,
  stanceShareInZone,
} from './index';

const P: CompressionParams = {
  peakDeg: 25,
  widthDeg: 7.5,
  baseline: 0.55,
  hipDropGain: 0.45,
  hipDropMaxDeg: 10,
};
const ZONE = { minDeg: 20, maxDeg: 30 };

describe('smoothstep', () => {
  it('clamps outside the ramp and eases inside', () => {
    expect(smoothstep(0, 10, -5)).toBe(0);
    expect(smoothstep(0, 10, 15)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5);
  });
  it('supports descending ramps', () => {
    expect(smoothstep(10, 0, 0)).toBe(1);
    expect(smoothstep(10, 0, 10)).toBe(0);
  });
});

describe('compression', () => {
  it('peaks at the configured knee angle', () => {
    const peak = compression(25, 0, P);
    expect(peak).toBeCloseTo(0.55);
    expect(compression(15, 0, P)).toBeLessThan(peak);
    expect(compression(40, 0, P)).toBeLessThan(peak);
  });
  it('is near zero with a straight or deeply flexed knee', () => {
    expect(compression(0, 0, P)).toBeLessThan(0.01);
    expect(compression(70, 10, P)).toBeLessThan(0.01);
  });
  it('increases with hip drop and never exceeds 1', () => {
    expect(compression(25, 6, P)).toBeGreaterThan(compression(25, 0, P));
    expect(compression(25, 10, P)).toBeCloseTo(1);
    expect(compression(25, 50, P)).toBeCloseTo(1);
  });
});

describe('gaitAngle', () => {
  const flat: GaitKeyframe[] = [
    { phase: 0, deg: 21 },
    { phase: 0.13, deg: 40 },
    { phase: 0.36, deg: 20 },
    { phase: 0.52, deg: 62 },
    { phase: 0.7, deg: 96 },
    { phase: 0.9, deg: 16 },
    { phase: 1, deg: 21 },
  ];
  it('hits keyframes exactly and loops', () => {
    expect(gaitAngle(flat, 0)).toBeCloseTo(21);
    expect(gaitAngle(flat, 0.13)).toBeCloseTo(40);
    expect(gaitAngle(flat, 1.13)).toBeCloseTo(40);
    expect(gaitAngle(flat, -0.3)).toBeCloseTo(96);
  });
  it('stays within keyframe bounds between keyframes', () => {
    for (let i = 0; i <= 100; i++) {
      const a = gaitAngle(flat, i / 100);
      expect(a).toBeGreaterThanOrEqual(16);
      expect(a).toBeLessThanOrEqual(96);
    }
  });
  it('foot strike on flat ground lands inside the impingement zone', () => {
    expect(inZone(gaitAngle(flat, 0), ZONE)).toBe(true);
  });
  it('fast running spends less of stance in the zone than easy running', () => {
    const fast: GaitKeyframe[] = [
      { phase: 0, deg: 33 },
      { phase: 0.11, deg: 49 },
      { phase: 0.28, deg: 30 },
      { phase: 0.45, deg: 85 },
      { phase: 0.62, deg: 118 },
      { phase: 0.88, deg: 30 },
      { phase: 1, deg: 33 },
    ];
    expect(stanceShareInZone(fast, 0.28, ZONE)).toBeLessThan(stanceShareInZone(flat, 0.36, ZONE));
  });
  it('rejects empty keyframes', () => {
    expect(() => gaitAngle([], 0)).toThrow();
  });
});

describe('softTissueWeights', () => {
  const hipY = 42;
  const kneeY = 0;
  it('always sums to 1', () => {
    for (let y = -40; y <= 60; y += 3) {
      const w = softTissueWeights(y, hipY, kneeY);
      expect(w.pelvis + w.femur + w.tibia).toBeCloseTo(1);
    }
  });
  it('assigns tissue to the segment it sits on', () => {
    expect(softTissueWeights(-20, hipY, kneeY).tibia).toBe(1);
    expect(softTissueWeights(20, hipY, kneeY).femur).toBe(1);
    expect(softTissueWeights(55, hipY, kneeY).pelvis).toBe(1);
  });
});
