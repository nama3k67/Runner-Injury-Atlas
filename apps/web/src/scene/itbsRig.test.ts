import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import meta from '../../public/anatomy/leg-right.meta.json';
import { buildItbsRig } from './itbsRig';

const params = { peakDeg: 25, widthDeg: 7.5, baseline: 0.55, hipDropGain: 0.45, hipDropMaxDeg: 10 };
const [lx = 0, ly = 0, lz = 0] = meta.lfe;

// Stand-in for the GLB: one part per layer, named as in leg-right.meta.json. Femur and ITB are
// slabs beside the lateral epicondyle, finely sliced in y so Kaplan fibres find vertices.
function fakeGltf(): THREE.Group {
  const scene = new THREE.Group();
  const parts: [string, THREE.BufferGeometry][] = [
    ['femur', new THREE.BoxGeometry(2, 6, 2, 1, 30, 1).translate(lx - 1, ly + 3, lz)],
    ['itb', new THREE.BoxGeometry(0.5, 6, 2, 1, 30, 1).translate(lx + 1.25, ly + 3, lz)],
    ['vl', new THREE.BoxGeometry(1, 1, 1)],
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
