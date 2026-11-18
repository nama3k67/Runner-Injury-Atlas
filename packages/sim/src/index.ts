/**
 * Pure simulation maths for the atlas. No DOM, no three.js: everything here is
 * deterministic and unit-tested, so the 3D scene only has to draw the result.
 *
 * The numbers are QUALITATIVE illustrations anchored on published findings
 * (see content/injuries/itbs/simulation.json for sources), not measurements.
 */

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Hermite smoothstep from `a` to `b`. Works with a > b (descending ramp). */
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export interface CompressionParams {
  /** Knee flexion angle (deg) where compression peaks. */
  peakDeg: number;
  /** Width of the bell curve (deg). */
  widthDeg: number;
  /** Compression at the peak with a level pelvis (0..1). */
  baseline: number;
  /** Extra compression added at maximum hip drop (0..1). baseline + hipDropGain <= 1. */
  hipDropGain: number;
  hipDropMaxDeg: number;
}

/**
 * Illustrative compression (0..1) of the fat pad under the ITB for a knee
 * flexion angle and a contralateral pelvic drop angle.
 */
export function compression(kneeDeg: number, hipDropDeg: number, p: CompressionParams): number {
  const bell = Math.exp(-(((kneeDeg - p.peakDeg) / p.widthDeg) ** 2));
  const hip = clamp(hipDropDeg, 0, p.hipDropMaxDeg) / p.hipDropMaxDeg;
  return bell * (p.baseline + p.hipDropGain * hip);
}

export interface Zone {
  minDeg: number;
  maxDeg: number;
}

export const inZone = (kneeDeg: number, zone: Zone): boolean =>
  kneeDeg >= zone.minDeg && kneeDeg <= zone.maxDeg;

export interface GaitKeyframe {
  /** Position in the stride, 0..1. First keyframe must be 0, last must be 1. */
  phase: number;
  deg: number;
}

/** Knee flexion angle at a stride phase, cosine-eased between keyframes. */
export function gaitAngle(keyframes: readonly GaitKeyframe[], phase: number): number {
  const first = keyframes[0];
  if (!first) throw new Error('gaitAngle: no keyframes');
  const ph = ((phase % 1) + 1) % 1;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (!a || !b) continue;
    if (ph >= a.phase && ph <= b.phase) {
      const t = (ph - a.phase) / (b.phase - a.phase);
      const eased = (1 - Math.cos(Math.PI * t)) / 2;
      return a.deg + (b.deg - a.deg) * eased;
    }
  }
  return first.deg;
}

/** Fraction of the stance phase (0..stanceEnd) spent inside the zone. */
export function stanceShareInZone(
  keyframes: readonly GaitKeyframe[],
  stanceEnd: number,
  zone: Zone,
  samples = 200,
): number {
  let hits = 0;
  for (let i = 0; i <= samples; i++) {
    if (inZone(gaitAngle(keyframes, (i / samples) * stanceEnd), zone)) hits++;
  }
  return hits / (samples + 1);
}

export interface SkinWeights {
  pelvis: number;
  femur: number;
  tibia: number;
}

/**
 * Blend weights for a soft-tissue vertex (muscle, ITB) by its height, so the
 * tissue bends across the hip and knee instead of tearing. Units: cm, y up.
 */
export function softTissueWeights(y: number, hipY: number, kneeY: number): SkinWeights {
  const tibia = smoothstep(kneeY + 2.2, kneeY - 2.0, y);
  const pelvis = smoothstep(hipY - 2.5, hipY + 4.5, y) * (1 - tibia);
  const femur = Math.max(0, 1 - tibia - pelvis);
  return { pelvis, femur, tibia };
}

export type Segment = keyof SkinWeights;

/** Bones follow one segment rigidly; anything not listed is soft tissue and is blended. */
const RIGID_SEGMENT: Readonly<Record<string, Segment>> = {
  pelvisR: 'pelvis',
  pelvisL: 'pelvis',
  sacrum: 'pelvis',
  femur: 'femur',
  patella: 'tibia',
  tibia: 'tibia',
  fibula: 'tibia',
  talus: 'tibia',
  calcaneus: 'tibia',
  navicular: 'tibia',
  cuboid: 'tibia',
  cun1: 'tibia',
  cun2: 'tibia',
  cun3: 'tibia',
  mt1: 'tibia',
  mt2: 'tibia',
  mt3: 'tibia',
  mt4: 'tibia',
  mt5: 'tibia',
};

/** Skin weights for a vertex of an anatomy part (names from leg-right.meta.json). */
export function partWeights(part: string, y: number, hipY: number, kneeY: number): SkinWeights {
  const rigid = RIGID_SEGMENT[part];
  if (!rigid) return softTissueWeights(y, hipY, kneeY);
  return { pelvis: 0, femur: 0, tibia: 0, [rigid]: 1 };
}

export interface RigPose {
  /** Flexion about the knee axis. */
  tibiaFlexDeg: number;
  /** Tibial internal rotation that accompanies flexion (reverse screw-home). */
  tibiaRotDeg: number;
  /** Contralateral pelvic drop, about the forward axis. */
  pelvisRollDeg: number;
  /** Femur relative to the pelvis: the hip adducts as the pelvis drops. */
  femurRollDeg: number;
}

export function rigPose(kneeDeg: number, hipDropDeg: number): RigPose {
  return {
    tibiaFlexDeg: kneeDeg,
    tibiaRotDeg: 9 * smoothstep(0, 60, kneeDeg),
    pelvisRollDeg: hipDropDeg,
    femurRollDeg: -1.6 * hipDropDeg,
  };
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ItbVertexFeatures {
  /** 1 near the knee, 0 towards the hip. */
  distal: number;
  /** How much this vertex sits over the lateral epicondyle, where the fat pad is squeezed. */
  knee: number;
}

/** Per-vertex ITB features in rest pose (cm, y up, +x lateral). */
export function itbVertexFeatures(p: Vec3, lfe: Vec3, kneeY: number): ItbVertexFeatures {
  const lateral = p.x > lfe.x - 1.2 ? 1 : 0;
  return {
    distal: smoothstep(16, 4, p.y - kneeY),
    knee:
      Math.exp(-(((p.y - lfe.y) / 2.2) ** 2)) * Math.exp(-(((p.z - lfe.z) / 2.8) ** 2)) * lateral,
  };
}

/** ITB morph target: displacement (cm) per unit of `knee` at full compression. */
export const ITB_COMPRESSION_MORPH: Readonly<Vec3> = { x: -0.42, y: 0, z: 0.06 };

/** Colour mix for an ITB vertex: `tense` towards amber, `hot` towards red (both 0..1). */
export function itbHeat(
  f: ItbVertexFeatures,
  hipDropDeg: number,
  hipDropMaxDeg: number,
  compression: number,
): { tense: number; hot: number } {
  const hip = clamp(hipDropDeg, 0, hipDropMaxDeg) / hipDropMaxDeg;
  return {
    tense: Math.min(1, hip * (0.3 + 0.45 * f.distal)),
    hot: Math.min(1, compression * f.knee * 1.15),
  };
}

export interface FatPadPlacement {
  center: Vec3;
  /** Half the gap between femur and ITB, clamped to a visible range (cm). */
  halfWidth: number;
}

/**
 * Places the synthetic fat pad (not in BodyParts3D) in the gap between the
 * femur and the ITB at epicondyle height. Positions are flat xyz arrays.
 */
export function fatPadPlacement(
  itbPos: ArrayLike<number>,
  femurPos: ArrayLike<number>,
  lfe: Vec3,
): FatPadPlacement {
  const nearY = (pos: ArrayLike<number>, i: number) =>
    Math.abs((pos[i + 1] ?? Infinity) - lfe.y) < 0.8;

  let zSum = 0;
  let zCount = 0;
  for (let i = 0; i < itbPos.length; i += 3) {
    if (nearY(itbPos, i)) {
      zSum += itbPos[i + 2] ?? 0;
      zCount++;
    }
  }
  const zc = zCount ? zSum / zCount : lfe.z;
  const nearZ = (pos: ArrayLike<number>, i: number) =>
    Math.abs((pos[i + 2] ?? Infinity) - zc) < 0.9;

  let xi = Infinity;
  for (let i = 0; i < itbPos.length; i += 3) {
    if (nearY(itbPos, i) && nearZ(itbPos, i)) xi = Math.min(xi, itbPos[i] ?? Infinity);
  }
  let xf = -Infinity;
  for (let i = 0; i < femurPos.length; i += 3) {
    if (nearY(femurPos, i) && nearZ(femurPos, i)) xf = Math.max(xf, femurPos[i] ?? -Infinity);
  }
  if (xi === Infinity) xi = lfe.x + 0.6;
  if (xf === -Infinity) xf = lfe.x;

  const gap = xi - xf;
  return {
    center: { x: gap > 0.3 ? (xi + xf) / 2 : xf + 0.18, y: lfe.y - 0.2, z: zc + 0.3 },
    halfWidth: clamp(gap / 2, 0.16, 0.42),
  };
}

/** Fat pad response to compression: flattens across its width, shifts medially, reddens. */
export function fatPadState(compression: number): {
  widthScale: number;
  shiftX: number;
  heat: number;
} {
  return {
    widthScale: 1 - 0.5 * compression,
    shiftX: -0.1 * compression,
    heat: Math.min(1, compression * 1.25),
  };
}

/** Camera distance that fits a box of height `h` and width `h * widthRatio` in view. */
export function fitDistance(h: number, widthRatio: number, fovDeg: number, aspect: number): number {
  const tf = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  return Math.max(h / 2 / tf, (h * widthRatio) / 2 / (tf * aspect)) * 1.05;
}
