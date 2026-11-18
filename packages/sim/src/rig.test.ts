import { describe, expect, it } from 'vitest';
import {
  fatPadPlacement,
  fatPadState,
  fitDistance,
  itbHeat,
  itbVertexFeatures,
  partWeights,
  rigPose,
} from './index';

const HIP_Y = 38.5;
const KNEE_Y = 0;
const LFE = { x: 4.08, y: -0.24, z: -0.13 };

describe('partWeights', () => {
  it('binds bones rigidly to their segment regardless of height', () => {
    expect(partWeights('femur', 50, HIP_Y, KNEE_Y)).toEqual({ pelvis: 0, femur: 1, tibia: 0 });
    expect(partWeights('patella', 20, HIP_Y, KNEE_Y)).toEqual({ pelvis: 0, femur: 0, tibia: 1 });
    expect(partWeights('sacrum', -30, HIP_Y, KNEE_Y)).toEqual({ pelvis: 1, femur: 0, tibia: 0 });
  });
  it('blends soft tissue across the joints', () => {
    const w = partWeights('itb', KNEE_Y, HIP_Y, KNEE_Y);
    expect(w.femur).toBeGreaterThan(0);
    expect(w.tibia).toBeGreaterThan(0);
    expect(w.pelvis + w.femur + w.tibia).toBeCloseTo(1);
  });
});

describe('rigPose', () => {
  it('is neutral at a straight knee and level pelvis', () => {
    for (const deg of Object.values(rigPose(0, 0))) expect(deg).toBeCloseTo(0);
  });
  it('flexes the tibia by the knee angle and adds screw-home rotation up to 9 degrees', () => {
    expect(rigPose(30, 0).tibiaFlexDeg).toBe(30);
    expect(rigPose(30, 0).tibiaRotDeg).toBeCloseTo(4.5);
    expect(rigPose(90, 0).tibiaRotDeg).toBeCloseTo(9);
  });
  it('drops the pelvis and adducts the femur against it', () => {
    const p = rigPose(0, 5);
    expect(p.pelvisRollDeg).toBe(5);
    expect(p.femurRollDeg).toBeCloseTo(-8);
  });
});

describe('itbVertexFeatures', () => {
  it('marks vertices over the epicondyle as the compressed region', () => {
    const over = itbVertexFeatures({ x: LFE.x, y: LFE.y, z: LFE.z }, LFE, KNEE_Y);
    expect(over.knee).toBeCloseTo(1);
    expect(over.distal).toBe(1);
  });
  it('ignores the hip end and the medial side', () => {
    const high = itbVertexFeatures({ x: LFE.x, y: 30, z: LFE.z }, LFE, KNEE_Y);
    expect(high.knee).toBeLessThan(1e-6);
    expect(high.distal).toBe(0);
    expect(itbVertexFeatures({ x: LFE.x - 2, y: LFE.y, z: LFE.z }, LFE, KNEE_Y).knee).toBe(0);
  });
});

describe('itbHeat', () => {
  it('stays cold with no compression and a level pelvis', () => {
    expect(itbHeat({ distal: 1, knee: 1 }, 0, 10, 0)).toEqual({ tense: 0, hot: 0 });
  });
  it('heats only the compressed region', () => {
    expect(itbHeat({ distal: 1, knee: 1 }, 0, 10, 0.8).hot).toBeCloseTo(0.92);
    expect(itbHeat({ distal: 1, knee: 0 }, 0, 10, 0.8).hot).toBe(0);
  });
  it('adds tension with hip drop, more distally, capped at 1', () => {
    const distal = itbHeat({ distal: 1, knee: 0 }, 10, 10, 0).tense;
    const proximal = itbHeat({ distal: 0, knee: 0 }, 10, 10, 0).tense;
    expect(distal).toBeCloseTo(0.75);
    expect(proximal).toBeCloseTo(0.3);
    expect(itbHeat({ distal: 1, knee: 1 }, 10, 10, 1).hot).toBe(1);
  });
});

describe('fatPadPlacement', () => {
  // Two vertical strips at the epicondyle height: femur surface at x=4, ITB at x=4.6.
  const strip = (x: number): number[] =>
    [-0.6, -0.2, 0.2, 0.6].flatMap((dy) => [x, LFE.y + dy, LFE.z]);

  it('centres the pad in the gap between femur and ITB', () => {
    const pad = fatPadPlacement(strip(4.6), strip(4), LFE);
    expect(pad.center.x).toBeCloseTo(4.3);
    expect(pad.center.y).toBeCloseTo(LFE.y - 0.2);
    expect(pad.center.z).toBeCloseTo(LFE.z + 0.3);
    expect(pad.halfWidth).toBeCloseTo(0.3);
  });
  it('sits just outside the femur when the gap is too thin, with a minimum width', () => {
    const pad = fatPadPlacement(strip(4.1), strip(4), LFE);
    expect(pad.center.x).toBeCloseTo(4.18);
    expect(pad.halfWidth).toBeCloseTo(0.16);
  });
  it('falls back to the landmark when no vertices are near it', () => {
    const pad = fatPadPlacement([0, 50, 0], [0, 50, 0], LFE);
    expect(pad.center.x).toBeCloseTo(LFE.x + 0.3);
    expect(pad.center.z).toBeCloseTo(LFE.z + 0.3);
    expect(pad.halfWidth).toBeCloseTo(0.3);
  });
});

describe('fatPadState', () => {
  it('is at rest with no compression', () => {
    const s = fatPadState(0);
    expect(s.widthScale).toBe(1);
    expect(s.shiftX).toBeCloseTo(0);
    expect(s.heat).toBe(0);
  });
  it('flattens, shifts medially and turns red as compression rises', () => {
    const s = fatPadState(0.8);
    expect(s.widthScale).toBeCloseTo(0.6);
    expect(s.shiftX).toBeCloseTo(-0.08);
    expect(s.heat).toBe(1);
  });
});

describe('fitDistance', () => {
  it('fits the height on a wide viewport and the width on a narrow one', () => {
    const tf = Math.tan(Math.PI / 12);
    expect(fitDistance(100, 0.4, 30, 2)).toBeCloseTo((50 / tf) * 1.05);
    expect(fitDistance(100, 1, 30, 0.5)).toBeCloseTo((100 / tf) * 1.05);
  });
});
