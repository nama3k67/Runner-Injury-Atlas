import { describe, expect, it } from 'vitest';
import {
  bestVertex,
  compressionArrows,
  fatPadPlacement,
  fatPadState,
  fitDistance,
  itbHeat,
  itbVertexFeatures,
  kaplanFibres,
  partWeights,
  pelvicBar,
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
  it('places three medially pointing arrows just outside the ITB, stacked around the epicondyle', () => {
    const { arrowAnchors } = fatPadPlacement(strip(4.6), strip(4), LFE);
    expect(arrowAnchors).toHaveLength(3);
    arrowAnchors.forEach((p, j) => {
      expect(p.x).toBeCloseTo(6.8);
      expect(p.y).toBeCloseTo(LFE.y + (j - 1) * 1.1);
      expect(p.z).toBeCloseTo(LFE.z + 0.3 + (j - 1) * 0.2);
    });
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

describe('compressionArrows', () => {
  it('stays hidden at low compression', () => {
    expect(compressionArrows(0).visible).toBe(false);
    expect(compressionArrows(0.18).visible).toBe(false);
  });
  it('appears above 0.18 and grows with compression', () => {
    expect(compressionArrows(0.2)).toEqual({ visible: true, scale: 0.45 + 0.55 * 0.2 });
    expect(compressionArrows(1).scale).toBeCloseTo(1);
  });
});

describe('kaplanFibres', () => {
  // Vertices at the three fibre heights above the epicondyle.
  const at = (x: number, dys: number[], z = LFE.z): number[] =>
    dys.flatMap((dy) => [x, LFE.y + dy, z]);
  const ALL = [2.4, 3.6, 4.8];

  it('joins the most lateral femur point to the most medial ITB point at each height', () => {
    const femur = [...at(3, ALL), ...at(4, ALL), ...at(10, ALL, LFE.z - 1)];
    const itb = [...at(6, ALL), ...at(5, ALL)];
    const fibres = kaplanFibres(femur, itb, LFE);
    expect(fibres).toHaveLength(3);
    fibres.forEach((f, j) => {
      const y = LFE.y + (ALL[j] ?? 0);
      expect(f.a).toEqual({ x: 4, y, z: LFE.z });
      expect(f.b.x).toBeCloseTo(5.1);
      expect(f.b.y).toBeCloseTo(y - 0.4);
      expect(f.b.z).toBeCloseTo(LFE.z);
    });
  });
  it('keeps a minimum length when the ITB hugs the femur', () => {
    const [f] = kaplanFibres(at(4, [2.4]), at(4.2, [2.4]), LFE);
    expect(f?.b.x).toBeCloseTo(4.5);
  });
  it('skips a height where either surface has no vertices', () => {
    expect(kaplanFibres(at(4, ALL), at(5, [2.4]), LFE)).toHaveLength(1);
    expect(kaplanFibres([], [], LFE)).toEqual([]);
  });
});

describe('pelvicBar', () => {
  it('spans both iliac crests level and symmetric about the midline', () => {
    const { a, b } = pelvicBar({ x: 2, y: 53, z: -0.8 }, -7.5);
    expect(a).toEqual({ x: 2.6, y: 53.6, z: -0.8 });
    expect((a.x + b.x) / 2).toBeCloseTo(-7.5);
    expect(b.y).toBe(a.y);
    expect(b.z).toBe(a.z);
  });
});

describe('bestVertex', () => {
  const pos = [0, 0, 0, 1, 5, 2, 3, 5, -1, 9, 9, 9];

  it('returns the vertex with the highest score', () => {
    expect(bestVertex(pos, (v) => v.x)).toEqual({ x: 9, y: 9, z: 9 });
  });

  it('ignores vertices scored -Infinity, so a score can filter by height', () => {
    const atY5 = (v: { x: number; y: number; z: number }) => (v.y === 5 ? v.z : -Infinity);
    expect(bestVertex(pos, atY5)).toEqual({ x: 1, y: 5, z: 2 });
  });

  it('returns null when no vertex passes the filter', () => {
    expect(bestVertex(pos, () => -Infinity)).toBeNull();
    expect(bestVertex([], (v) => v.x)).toBeNull();
  });
});
