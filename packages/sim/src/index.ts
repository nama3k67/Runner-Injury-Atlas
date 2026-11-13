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
