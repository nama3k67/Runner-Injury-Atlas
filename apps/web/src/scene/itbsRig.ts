import {
  type CompressionParams,
  compression,
  compressionArrows,
  fatPadPlacement,
  fatPadState,
  fitDistance,
  ITB_COMPRESSION_MORPH,
  itbHeat,
  itbVertexFeatures,
  kaplanFibres,
  partWeights,
  pelvicBar,
  rigPose,
  type Vec3,
} from '@atlas/sim';
import * as THREE from 'three';
import meta from '../../public/anatomy/leg-right.meta.json';
import { type CameraView, LAYERS, type Layer, type LayerVisibility } from '../simStore';
import { PART_TERM, termAt } from './picking';

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
const v3 = (p: Vec3): THREE.Vector3 => new THREE.Vector3(p.x, p.y, p.z);

const HIP = vec(meta.hip);
const PIVOT = vec(meta.pivot);
const AXIS = vec(meta.axis).normalize();
const LFE = vec(meta.lfe);
const GERDY = vec(meta.gerdy);
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const D = THREE.MathUtils.degToRad;

/** The foot must travel posterior (+z) when the knee flexes, whatever the sign of the mesh axis. */
const FLEX_SIGN = new THREE.Vector3(0, -30, 0).applyAxisAngle(AXIS, 0.3).z > 0 ? 1 : -1;

export const FOOT_Y = Math.min(minY('calcaneus'), minY('mt1'));
const CREST = vec(meta.crestTop);
const crestY = CREST.y;
const SACRUM_MID_X = (vec(bounds.sacrum?.[0]).x + vec(bounds.sacrum?.[1]).x) / 2;

interface CameraPreset {
  target: THREE.Vector3;
  /** From the target towards the camera. */
  direction: THREE.Vector3;
  /** Height of the box to fit, and its width as a share of that height. */
  height: number;
  widthRatio: number;
}

const legMidY = (crestY + FOOT_Y) / 2;
const legHeight = crestY - FOOT_Y + 6;

/** Camera presets from legacy v0.3 (CAMS). */
export const CAMERA_PRESETS: Readonly<Record<CameraView, CameraPreset>> = {
  lateral: {
    target: new THREE.Vector3(2, legMidY, -1),
    direction: new THREE.Vector3(1, 0.05, -0.38),
    height: legHeight,
    widthRatio: 0.42,
  },
  front: {
    target: new THREE.Vector3(-4, legMidY + 2.5, -1),
    direction: new THREE.Vector3(0.16, 0.05, -1),
    height: legHeight + 9,
    widthRatio: 0.6,
  },
  knee: {
    target: LFE.clone().add(new THREE.Vector3(-1.5, -1.2, -0.6)),
    direction: new THREE.Vector3(0.88, 0.06, -0.48),
    height: 22,
    widthRatio: 1,
  },
  hip: {
    target: HIP.clone().add(new THREE.Vector3(2, 5, 0)),
    direction: new THREE.Vector3(0.82, 0.14, -0.56),
    height: 36,
    widthRatio: 1,
  },
};

/** Where the camera stands to frame `view` on a screen of the given aspect. */
export function cameraPose(
  view: CameraView,
  fovDeg: number,
  aspect: number,
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const p = CAMERA_PRESETS[view];
  const distance = fitDistance(p.height, p.widthRatio, fovDeg, aspect);
  const position = p.target.clone().addScaledVector(p.direction.clone().normalize(), distance);
  return { position, target: p.target.clone() };
}

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

function materialFor(part: string, group: string): THREE.MeshStandardMaterial {
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

/** A cylinder from `a` to `b` (same space). Caller owns and disposes the geometry. */
function cylinderBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  radialSegments = 8,
): THREE.Mesh {
  const d = b.clone().sub(a);
  const geo = new THREE.CylinderGeometry(radius, radius, d.length(), radialSegments);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(Y, d.normalize());
  return mesh;
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
const HIGHLIGHT = new THREE.Color(0x1f5f8f);

export interface ItbsRig {
  root: THREE.Group;
  /** Pose the rig and recolour tissue. Call once per frame. */
  update(kneeDeg: number, hipDropDeg: number): void;
  /** Show or hide whole layers. Cheap enough to call every frame. */
  showLayers(layers: LayerVisibility): void;
  /** Term of the nearest visible structure under the ray, or null. */
  pick(raycaster: THREE.Raycaster): string | null;
  /** Pulse one structure (a term id), or none. Call every frame after `update`. */
  highlight(structure: string | null, seconds: number): void;
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
  const skinned: THREE.SkinnedMesh[] = [];
  const pickables: THREE.Object3D[] = [];
  /** `rest` is null when `update` rewrites the emissive every frame anyway. */
  const glows: { term: string; material: THREE.MeshStandardMaterial; rest: THREE.Color | null }[] =
    [];
  const glow = (term: string, material: THREE.MeshStandardMaterial, rest = true) =>
    glows.push({ term, material, rest: rest ? material.emissive.clone() : null });
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
    skinned.push(mesh);
    const term = PART_TERM[part];
    if (term) {
      mesh.userData.term = term;
      pickables.push(mesh);
      glow(term, material);
    }
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
  fat.userData.term = 'fatpad';
  pickables.push(fat);
  glow('fatpad', fatMat, false);
  disposables.push(fatGeo, fatMat);

  // Illustrations, not in BodyParts3D (the page says so). Ported from legacy/v0.3.
  const kaplanMat = new THREE.MeshStandardMaterial({
    color: 0x9fd6fa,
    roughness: 0.4,
    emissive: 0x0d2233,
  });
  const kaplan = new THREE.Group();
  kaplan.name = 'kaplan';
  for (const f of kaplanFibres(femurPos ? femurPos.array : [], itbPos ? itbPos.array : [], LFE)) {
    const strand = cylinderBetween(v3(f.a).sub(HIP), v3(f.b).sub(HIP), 0.11, kaplanMat);
    kaplan.add(strand);
    disposables.push(strand.geometry);
  }
  femur.add(kaplan);
  byLayer.itb.push(kaplan);
  kaplan.userData.term = 'kaplan';
  pickables.push(kaplan);
  glow('kaplan', kaplanMat);

  // Invisible pick targets for the bony landmarks; they fade in only while selected (v0.3).
  const markers: { term: string; material: THREE.MeshStandardMaterial }[] = [];
  for (const [term, bone, at, radius] of [
    ['lfe', femur, LFE.clone().sub(HIP), 0.85],
    ['gerdy', tibia, GERDY.clone().sub(PIVOT), 0.75],
  ] as const) {
    const geo = new THREE.SphereGeometry(radius, 20, 14);
    const material = new THREE.MeshStandardMaterial({
      color: 0xfff1c9,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const marker = new THREE.Mesh(geo, material);
    marker.name = `${term}-marker`;
    marker.userData.term = term;
    marker.position.copy(at);
    bone.add(marker);
    byLayer.bone.push(marker);
    pickables.push(marker);
    markers.push({ term, material });
    disposables.push(geo, material);
  }
  disposables.push(kaplanMat);

  // Outer group follows the fat layer; the inner one shows only under compression.
  const arrowMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x5a0b0b });
  const coneGeo = new THREE.ConeGeometry(0.42, 1.1, 14).rotateZ(Math.PI / 2).translate(-0.55, 0, 0);
  const shaftGeo = new THREE.CylinderGeometry(0.13, 0.13, 1.4, 8)
    .rotateZ(Math.PI / 2)
    .translate(0.6, 0, 0);
  const arrows = new THREE.Group();
  arrows.name = 'compression-arrows';
  for (const p of pad.arrowAnchors) {
    const arrow = new THREE.Group();
    arrow.add(new THREE.Mesh(coneGeo, arrowMat), new THREE.Mesh(shaftGeo, arrowMat));
    arrow.position.copy(v3(p)).sub(HIP);
    arrows.add(arrow);
  }
  const arrowsLayer = new THREE.Group();
  arrowsLayer.add(arrows);
  femur.add(arrowsLayer);
  byLayer.fat.push(arrowsLayer);
  disposables.push(arrowMat, coneGeo, shaftGeo);

  // Bar on the pelvis tilts with hip drop; the dashed line stays level as the reference.
  const crests = pelvicBar(CREST, SACRUM_MID_X);
  const barMat = new THREE.MeshStandardMaterial({ color: 0xf5a524, emissive: 0x3a2600 });
  const bar = cylinderBetween(v3(crests.a).sub(HIP), v3(crests.b).sub(HIP), 0.28, barMat, 10);
  bar.name = 'pelvic-bar';
  pelvis.add(bar);
  const levelGeo = new THREE.BufferGeometry().setFromPoints([v3(crests.a), v3(crests.b)]);
  const levelMat = new THREE.LineDashedMaterial({ color: 0x4b5f80, dashSize: 1.2, gapSize: 0.9 });
  const level = new THREE.Line(levelGeo, levelMat);
  level.name = 'pelvic-level';
  level.computeLineDistances();
  root.add(level);
  byLayer.bone.push(bar, level);
  disposables.push(barMat, bar.geometry, levelGeo, levelMat);

  const flex = new THREE.Quaternion();
  const screw = new THREE.Quaternion();
  const tmp = new THREE.Color();
  let paintedKey = '';
  let poseKey = '';
  let boundsKey = '';

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
      poseKey = `${kneeDeg}|${hipDropDeg}`;
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

      const a = compressionArrows(c);
      arrows.visible = a.visible;
      for (const arrow of arrows.children) arrow.scale.setScalar(a.scale);
    },
    showLayers(layers) {
      for (const layer of LAYERS) for (const o of byLayer[layer]) o.visible = layers[layer];
    },
    pick(raycaster) {
      root.updateMatrixWorld();
      // three caches skinned bounds from the pose of the first raycast; stale bounds miss moved bones.
      if (boundsKey !== poseKey) {
        for (const m of skinned) {
          m.computeBoundingSphere();
          m.computeBoundingBox();
        }
        boundsKey = poseKey;
      }
      return termAt(raycaster.intersectObjects(pickables, true));
    },
    highlight(structure, seconds) {
      const pulse = 0.5 + 0.5 * Math.sin(seconds * 5.5);
      for (const g of glows) {
        if (g.rest) g.material.emissive.copy(g.rest);
        if (g.term === structure) g.material.emissive.lerp(HIGHLIGHT, 0.5 + 0.5 * pulse);
      }
      for (const m of markers) m.material.opacity = m.term === structure ? 0.35 + 0.35 * pulse : 0;
    },
    dispose() {
      for (const d of disposables) d.dispose();
      skeleton.dispose();
    },
  };
}
