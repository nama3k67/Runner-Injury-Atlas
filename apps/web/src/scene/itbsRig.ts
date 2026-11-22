import {
  type CompressionParams,
  compression,
  fatPadPlacement,
  fatPadState,
  ITB_COMPRESSION_MORPH,
  itbHeat,
  itbVertexFeatures,
  partWeights,
  rigPose,
} from '@atlas/sim';
import * as THREE from 'three';
import meta from '../../public/anatomy/leg-right.meta.json';
import { LAYERS, type Layer, type LayerVisibility } from '../simStore';

// Imperative three.js on purpose (ADR 0002): skinning and per-vertex colour run every
// frame and must not go through React. Ported from legacy/v0.3 (updateRig, prepITB, paintITB).

type Triple = readonly number[];

function vec(a: Triple | undefined): THREE.Vector3 {
  const [x, y, z] = a ?? [];
  if (x === undefined || y === undefined || z === undefined) {
    throw new Error('leg-right.meta.json: expected an [x, y, z] vector');
  }
  return new THREE.Vector3(x, y, z);
}

const bounds: Readonly<Record<string, readonly Triple[]>> = meta.bounds;
const minY = (part: string): number => vec(bounds[part]?.[0]).y;

const HIP = vec(meta.hip);
const PIVOT = vec(meta.pivot);
const AXIS = vec(meta.axis).normalize();
const LFE = vec(meta.lfe);
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const D = THREE.MathUtils.degToRad;

/** The foot must travel posterior (+z) when the knee flexes, whatever the sign of the mesh axis. */
const FLEX_SIGN = new THREE.Vector3(0, -30, 0).applyAxisAngle(AXIS, 0.3).z > 0 ? 1 : -1;

export const FOOT_Y = Math.min(minY('calcaneus'), minY('mt1'));
const crestY = vec(meta.crestTop).y;

/** Lateral camera preset from v0.3: the whole leg seen from the outside. */
export const LATERAL_VIEW = {
  target: new THREE.Vector3(2, (crestY + FOOT_Y) / 2, -1),
  direction: new THREE.Vector3(1, 0.05, -0.38).normalize(),
  height: crestY - FOOT_Y + 6,
  widthRatio: 0.42,
};

const MUSCLE_COLOUR: Readonly<Record<string, number>> = {
  gmax: 0xa8423d,
  gmed: 0xb44c44,
  tfl: 0xc0584a,
  vl: 0xae463f,
  rf: 0x9a3f3a,
  bfl: 0x8f3a36,
  bfs: 0x8f3a36,
};
const DIM_BONES = new Set(['navicular', 'cuboid', 'talus', 'calcaneus', 'pelvisL', 'sacrum']);
const CONTEXT_MUSCLES = new Set(['rf', 'bfl', 'bfs']);

function materialFor(part: string, group: string): THREE.Material {
  if (group === 'bone') {
    const dim = DIM_BONES.has(part) || part.startsWith('mt') || part.startsWith('cun');
    return new THREE.MeshStandardMaterial(
      dim
        ? { color: 0xcfc6b2, roughness: 0.7, envMapIntensity: 0.5 }
        : { color: 0xe6dcc6, roughness: 0.62, metalness: 0, envMapIntensity: 0.7 },
    );
  }
  if (group === 'muscle') {
    const color = MUSCLE_COLOUR[part] ?? 0xa8423d;
    return new THREE.MeshStandardMaterial(
      CONTEXT_MUSCLES.has(part)
        ? {
            color,
            roughness: 0.55,
            transparent: true,
            opacity: 0.38,
            depthWrite: false,
            envMapIntensity: 0.4,
          }
        : { color, roughness: 0.5, metalness: 0, envMapIntensity: 0.6 },
    );
  }
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.32,
    metalness: 0,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xbfe3ff),
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    transparent: true,
    opacity: 0.86,
    side: THREE.DoubleSide,
    emissive: 0x0a1a28,
  });
}

function applySkinWeights(geo: THREE.BufferGeometry, part: string): void {
  const pos = geo.getAttribute('position');
  const index = new Uint16Array(pos.count * 4);
  const weight = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const w = partWeights(part, pos.getY(i), HIP.y, PIVOT.y);
    index.set([0, 1, 2, 0], i * 4);
    weight.set([w.pelvis, w.femur, w.tibia, 0], i * 4);
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
}

interface ItbPaint {
  colours: THREE.BufferAttribute;
  distal: Float32Array;
  knee: Float32Array;
}

function prepareItb(geo: THREE.BufferGeometry): ItbPaint {
  const pos = geo.getAttribute('position');
  const distal = new Float32Array(pos.count);
  const knee = new Float32Array(pos.count);
  const morph = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const f = itbVertexFeatures({ x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) }, LFE, PIVOT.y);
    distal[i] = f.distal;
    knee[i] = f.knee;
    morph.set(
      [ITB_COMPRESSION_MORPH.x * f.knee, ITB_COMPRESSION_MORPH.y, ITB_COMPRESSION_MORPH.z * f.knee],
      i * 3,
    );
  }
  geo.morphAttributes.position = [new THREE.Float32BufferAttribute(morph, 3)];
  geo.morphTargetsRelative = true;
  const colours = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
  geo.setAttribute('color', colours);
  return { colours, distal, knee };
}

const ITB_BASE = new THREE.Color(0xc9dcea);
const ITB_TENSE = new THREE.Color(0xf5a524);
const ITB_HOT = new THREE.Color(0xff3b30);
const FAT_REST = new THREE.Color(0xf2cf63);
const FAT_HOT = new THREE.Color(0xef4444);
const FAT_GLOW = new THREE.Color(0x7a0a0a);
const BLACK = new THREE.Color(0x000000);

export interface ItbsRig {
  root: THREE.Group;
  /** Pose the rig and recolour tissue. Call once per frame. */
  update(kneeDeg: number, hipDropDeg: number): void;
  /** Show or hide whole layers. Cheap enough to call every frame. */
  showLayers(layers: LayerVisibility): void;
  dispose(): void;
}

/** Builds the skinned leg from the anatomy GLB. Geometry is cloned, so the loader cache stays intact. */
export function buildItbsRig(gltfScene: THREE.Object3D, params: CompressionParams): ItbsRig {
  const source: Record<string, THREE.BufferGeometry> = {};
  gltfScene.traverse((o) => {
    if (o instanceof THREE.Mesh) source[o.name] = o.geometry;
  });

  const root = new THREE.Group();
  const pelvis = new THREE.Bone();
  pelvis.position.copy(HIP);
  const femur = new THREE.Bone();
  pelvis.add(femur);
  const tibia = new THREE.Bone();
  tibia.position.copy(PIVOT).sub(HIP);
  femur.add(tibia);
  root.add(pelvis);
  root.updateMatrixWorld(true);
  // Bone inverses are taken from the current (rest) pose, so the skeleton must be built after the update above.
  const skeleton = new THREE.Skeleton([pelvis, femur, tibia]);

  const disposables: { dispose(): void }[] = [];
  const byLayer: Record<Layer, THREE.Object3D[]> = { bone: [], muscle: [], itb: [], fat: [] };
  let itbMesh: THREE.SkinnedMesh | null = null;
  let itbPaint: ItbPaint | null = null;

  for (const [part, group] of Object.entries(meta.parts)) {
    const original = source[part];
    if (!original) continue;
    const geo = original.clone();
    geo.deleteAttribute('uv');
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    if (group === 'itb') itbPaint = prepareItb(geo);
    applySkinWeights(geo, part);
    const material = materialFor(part, group);
    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.name = part;
    mesh.frustumCulled = false;
    root.add(mesh);
    mesh.bind(skeleton, new THREE.Matrix4());
    if (group === 'bone' || group === 'muscle' || group === 'itb') byLayer[group].push(mesh);
    if (group === 'itb') {
      itbMesh = mesh;
      mesh.renderOrder = 3;
    }
    disposables.push(geo, material);
  }

  const itbPos = source.itb?.getAttribute('position');
  const femurPos = source.femur?.getAttribute('position');
  const pad = fatPadPlacement(itbPos ? itbPos.array : [], femurPos ? femurPos.array : [], LFE);
  const padRest = new THREE.Vector3(pad.center.x, pad.center.y, pad.center.z).sub(HIP);
  const fatGeo = new THREE.SphereGeometry(1, 28, 18);
  const fatMat = new THREE.MeshStandardMaterial({ color: FAT_REST, roughness: 0.45 });
  const fat = new THREE.Mesh(fatGeo, fatMat);
  fat.name = 'fatpad';
  fat.scale.set(pad.halfWidth, 1.05, 1.25);
  fat.position.copy(padRest);
  femur.add(fat);
  byLayer.fat.push(fat);
  disposables.push(fatGeo, fatMat);

  const flex = new THREE.Quaternion();
  const screw = new THREE.Quaternion();
  const tmp = new THREE.Color();
  let paintedKey = '';

  function paintItb(hipDropDeg: number, c: number): void {
    if (!itbPaint) return;
    const key = `${hipDropDeg}|${c.toFixed(3)}`;
    if (key === paintedKey) return;
    paintedKey = key;
    const { colours, distal, knee } = itbPaint;
    for (let i = 0; i < colours.count; i++) {
      const heat = itbHeat(
        { distal: distal[i] ?? 0, knee: knee[i] ?? 0 },
        hipDropDeg,
        params.hipDropMaxDeg,
        c,
      );
      tmp.copy(ITB_BASE).lerp(ITB_TENSE, heat.tense).lerp(ITB_HOT, heat.hot);
      colours.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    colours.needsUpdate = true;
  }

  return {
    root,
    update(kneeDeg, hipDropDeg) {
      const pose = rigPose(kneeDeg, hipDropDeg);
      flex.setFromAxisAngle(AXIS, FLEX_SIGN * D(pose.tibiaFlexDeg));
      screw.setFromAxisAngle(Y, D(pose.tibiaRotDeg));
      tibia.quaternion.copy(flex).multiply(screw);
      pelvis.quaternion.setFromAxisAngle(Z, D(pose.pelvisRollDeg));
      femur.quaternion.setFromAxisAngle(Z, D(pose.femurRollDeg));

      const c = compression(kneeDeg, hipDropDeg, params);
      const influences = itbMesh?.morphTargetInfluences;
      if (influences) influences[0] = c;
      paintItb(hipDropDeg, c);

      const s = fatPadState(c);
      fat.scale.x = pad.halfWidth * s.widthScale;
      fat.position.copy(padRest).addScaledVector(X, s.shiftX);
      fatMat.color.copy(FAT_REST).lerp(FAT_HOT, s.heat);
      fatMat.emissive.copy(BLACK).lerp(FAT_GLOW, c);
    },
    showLayers(layers) {
      for (const layer of LAYERS) for (const o of byLayer[layer]) o.visible = layers[layer];
    },
    dispose() {
      for (const d of disposables) d.dispose();
      skeleton.dispose();
    },
  };
}
