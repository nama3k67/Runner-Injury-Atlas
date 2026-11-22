import { fitDistance } from '@atlas/sim';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import meta from '../../public/anatomy/leg-right.meta.json';
import { buildItbsRig, CAMERA_PRESETS, cameraPose } from './itbsRig';

const params = { peakDeg: 25, widthDeg: 7.5, baseline: 0.55, hipDropGain: 0.45, hipDropMaxDeg: 10 };
const [lx = 0, ly = 0, lz = 0] = meta.lfe;
const [px = 0, py = 0, pz = 0] = meta.pivot;

// Stand-in for the GLB: one part per layer, named as in leg-right.meta.json. Femur and ITB are
// slabs beside the lateral epicondyle, finely sliced in y so Kaplan fibres find vertices. The tibia
// hangs below the knee pivot.
function fakeGltf(): THREE.Group {
  const scene = new THREE.Group();
  const parts: [string, THREE.BufferGeometry][] = [
    ['femur', new THREE.BoxGeometry(2, 6, 2, 1, 30, 1).translate(lx - 1, ly + 3, lz)],
    ['itb', new THREE.BoxGeometry(0.5, 6, 2, 1, 30, 1).translate(lx + 1.25, ly + 3, lz)],
    ['vl', new THREE.BoxGeometry(1, 1, 1)],
    ['tibia', new THREE.BoxGeometry(2, 10, 2, 1, 20, 1).translate(px, py - 6, pz)],
  ];
  for (const [name, geo] of parts) {
    const mesh = new THREE.Mesh(geo);
    mesh.name = name;
    scene.add(mesh);
  }
  return scene;
}

/** Rendered only if it and every ancestor are visible. */
function shown(o: THREE.Object3D | undefined): boolean {
  for (let n: THREE.Object3D | null = o ?? null; n; n = n.parent) if (!n.visible) return false;
  return o !== undefined;
}

const ALL_ON = { bone: true, muscle: true, itb: true, fat: true };

describe('buildItbsRig layers', () => {
  it('hides exactly the meshes of the layers that are off', () => {
    const rig = buildItbsRig(fakeGltf(), params);
    const visible = (name: string) => rig.root.getObjectByName(name)?.visible;

    rig.showLayers({ bone: true, muscle: false, itb: true, fat: false });
    expect([visible('femur'), visible('vl'), visible('itb'), visible('fatpad')]).toEqual([
      true,
      false,
      true,
      false,
    ]);

    rig.showLayers({ bone: false, muscle: true, itb: false, fat: true });
    expect([visible('femur'), visible('vl'), visible('itb'), visible('fatpad')]).toEqual([
      false,
      true,
      false,
      true,
    ]);
    rig.dispose();
  });
});

describe('buildItbsRig illustrative structures', () => {
  it('adds three Kaplan fibres that follow the ITB layer', () => {
    const rig = buildItbsRig(fakeGltf(), params);
    const kaplan = rig.root.getObjectByName('kaplan');
    expect(kaplan?.children).toHaveLength(3);

    rig.showLayers({ ...ALL_ON, itb: false });
    expect(shown(kaplan)).toBe(false);
    rig.showLayers(ALL_ON);
    expect(shown(kaplan)).toBe(true);
    rig.dispose();
  });

  it('shows compression arrows only in the impingement zone and with the fat layer on', () => {
    const rig = buildItbsRig(fakeGltf(), params);
    const arrows = rig.root.getObjectByName('compression-arrows');
    expect(arrows?.children.length).toBeGreaterThan(0);
    rig.showLayers(ALL_ON);

    rig.update(0, 0);
    expect(shown(arrows)).toBe(false);
    rig.update(25, 0);
    expect(shown(arrows)).toBe(true);

    rig.showLayers({ ...ALL_ON, fat: false });
    expect(shown(arrows)).toBe(false);
    rig.dispose();
  });

  it('puts the pelvic bar and its level reference in the bone layer', () => {
    const rig = buildItbsRig(fakeGltf(), params);
    const bar = rig.root.getObjectByName('pelvic-bar');
    const level = rig.root.getObjectByName('pelvic-level');
    rig.showLayers(ALL_ON);
    expect([shown(bar), shown(level)]).toEqual([true, true]);
    rig.showLayers({ ...ALL_ON, bone: false });
    expect([shown(bar), shown(level)]).toEqual([false, false]);
    rig.dispose();
  });

  it('tilts the pelvic bar with hip drop while the level reference stays put', () => {
    const rig = buildItbsRig(fakeGltf(), params);
    const bar = rig.root.getObjectByName('pelvic-bar');
    const level = rig.root.getObjectByName('pelvic-level');
    const worldQuat = (o: THREE.Object3D | undefined) => {
      rig.root.updateMatrixWorld(true);
      return o?.getWorldQuaternion(new THREE.Quaternion());
    };

    rig.update(0, 0);
    const barRest = worldQuat(bar)?.clone();
    const levelRest = worldQuat(level)?.clone();
    rig.update(0, 8);
    expect(barRest && worldQuat(bar)?.angleTo(barRest)).toBeGreaterThan(0.01);
    expect(levelRest && worldQuat(level)?.angleTo(levelRest)).toBeCloseTo(0);
    rig.dispose();
  });
});

/** A ray travelling in -x (from the lateral side) through `at`. */
function lateralRay(at: THREE.Vector3): THREE.Raycaster {
  return new THREE.Raycaster(
    at.clone().add(new THREE.Vector3(50, 0, 0)),
    new THREE.Vector3(-1, 0, 0),
  );
}

describe('buildItbsRig picking', () => {
  it('returns the term of the nearest visible structure', () => {
    const rig = buildItbsRig(fakeGltf(), params);
    rig.update(0, 0);
    const thigh = lateralRay(new THREE.Vector3(lx, ly + 5, lz));

    rig.showLayers(ALL_ON);
    expect(rig.pick(thigh)).toBe('itb');
    rig.showLayers({ ...ALL_ON, itb: false });
    expect(rig.pick(thigh)).toBe('femur');
    rig.showLayers({ ...ALL_ON, itb: false, bone: false });
    expect(rig.pick(thigh)).toBeNull();
    rig.dispose();
  });

  it('picks the lateral epicondyle marker even though it is drawn transparent', () => {
    const rig = buildItbsRig(fakeGltf(), params);
    rig.update(0, 0);
    rig.showLayers({ ...ALL_ON, itb: false, fat: false });
    expect(rig.pick(lateralRay(new THREE.Vector3(lx, ly, lz)))).toBe('lfe');
    rig.dispose();
  });

  it('still hits the tibia after the knee bends, where three would use the rest-pose bounds', () => {
    const rig = buildItbsRig(fakeGltf(), params);
    rig.showLayers(ALL_ON);
    const tibia = rig.root.getObjectByName('tibia');
    if (!(tibia instanceof THREE.SkinnedMesh)) throw new Error('tibia mesh missing');
    const centroid = () => {
      rig.root.updateMatrixWorld(true);
      const sum = new THREE.Vector3();
      const v = new THREE.Vector3();
      const n = tibia.geometry.getAttribute('position').count;
      for (let i = 0; i < n; i++) sum.add(tibia.getVertexPosition(i, v));
      return tibia.localToWorld(sum.divideScalar(n));
    };

    rig.update(0, 0);
    const rest = centroid();
    expect(rig.pick(lateralRay(rest))).toBe('tibia');

    rig.update(90, 0);
    const bent = centroid();
    expect(bent.distanceTo(rest)).toBeGreaterThan(3);
    expect(rig.pick(lateralRay(bent))).toBe('tibia');
    rig.dispose();
  });
});

describe('buildItbsRig highlight', () => {
  it('lights only the selected structure and restores it when cleared', () => {
    const rig = buildItbsRig(fakeGltf(), params);
    const emissive = (name: string) => {
      const o = rig.root.getObjectByName(name);
      return o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial
        ? o.material.emissive.getHex()
        : undefined;
    };
    const markerOpacity = () => {
      const o = rig.root.getObjectByName('lfe-marker');
      return o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial
        ? o.material.opacity
        : undefined;
    };
    const femurRest = emissive('femur');
    const vlRest = emissive('vl');

    rig.highlight('femur', 0);
    expect(emissive('femur')).not.toBe(femurRest);
    expect(emissive('vl')).toBe(vlRest);
    expect(markerOpacity()).toBe(0);

    rig.highlight('lfe', 0);
    expect(emissive('femur')).toBe(femurRest);
    expect(markerOpacity()).toBeGreaterThan(0);

    rig.highlight(null, 0);
    expect(markerOpacity()).toBe(0);
    rig.dispose();
  });
});

describe('cameraPose', () => {
  it('places the camera along the preset direction, at the distance that fits the preset', () => {
    for (const [name, preset] of Object.entries(CAMERA_PRESETS)) {
      const { position, target } = cameraPose(name as keyof typeof CAMERA_PRESETS, 30, 1.5);
      expect(target.equals(preset.target), name).toBe(true);
      const offset = position.clone().sub(target);
      expect(offset.length(), name).toBeCloseTo(
        fitDistance(preset.height, preset.widthRatio, 30, 1.5),
      );
      expect(offset.normalize().dot(preset.direction.clone().normalize()), name).toBeCloseTo(1);
    }
  });

  it('backs off when the screen is narrower than the preset, so it still fits', () => {
    const distance = (aspect: number) =>
      cameraPose('lateral', 30, aspect).position.distanceTo(CAMERA_PRESETS.lateral.target);
    // The lateral preset is 0.42 as wide as it is tall: height decides above that, width below.
    expect(distance(0.3)).toBeGreaterThan(distance(1.8));
    expect(distance(0.6)).toBeCloseTo(distance(1.8));
  });

  it('aims the knee preset at the lateral epicondyle', () => {
    expect(cameraPose('knee', 30, 1).target.distanceTo(new THREE.Vector3(lx, ly, lz))).toBeLessThan(
      3,
    );
  });
});
