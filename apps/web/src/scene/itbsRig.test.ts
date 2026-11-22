import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildItbsRig } from './itbsRig';

const params = { peakDeg: 25, widthDeg: 7.5, baseline: 0.55, hipDropGain: 0.45, hipDropMaxDeg: 10 };

// Stand-in for the GLB: one part per layer, named as in leg-right.meta.json.
function fakeGltf(): THREE.Group {
  const scene = new THREE.Group();
  for (const name of ['femur', 'vl', 'itb']) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.name = name;
    scene.add(mesh);
  }
  return scene;
}

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
