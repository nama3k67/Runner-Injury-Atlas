import type { CompressionParams } from '@atlas/sim';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { PMREMGenerator, Raycaster, Vector2, type Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildItbsRig, cameraPose, FOOT_Y, type ItbsRig } from '../scene/itbsRig';
import { LABELS, labelShown } from '../scene/labels';
import { isClick } from '../scene/picking';
import { useSimStore } from '../simStore';

interface Props {
  params: CompressionParams;
  /** Term id -> the structure to highlight when that term is open. */
  structures: Readonly<Record<string, string>>;
  /** Term under the mouse (null when none), at canvas-relative pixels. */
  onHover: (term: string | null, x: number, y: number) => void;
  onReady: () => void;
}

const GLB_URL = '/anatomy/leg-right.glb';
const FOV = 30;

export default function AnatomyScene(props: Props) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.5, far: 900 }}
      gl={{ antialias: true, alpha: true, toneMappingExposure: 1.05 }}
    >
      <RoomLighting />
      <hemisphereLight args={[0xdbe8ff, 0x1a2030, 0.55]} />
      <directionalLight color={0xfff4e6} intensity={1.5} position={[80, 60, -50]} />
      <directionalLight color={0x8ccaf5} intensity={0.9} position={[-60, 30, 70]} />
      <directionalLight color={0xffffff} intensity={0.35} position={[20, -40, -80]} />
      <gridHelper args={[120, 24, 0x22324d, 0x16233a]} position={[0, FOOT_Y - 0.3, 0]} />
      <Suspense fallback={null}>
        <Leg {...props} />
      </Suspense>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={420}
      />
      <CameraRig />
    </Canvas>
  );
}

function Leg({ params, structures, onHover, onReady }: Props) {
  const gltf = useLoader(GLTFLoader, GLB_URL);
  const rig = useMemo(() => buildItbsRig(gltf.scene, params), [gltf, params]);

  useEffect(() => {
    onReady();
    return () => rig.dispose();
  }, [rig, onReady]);

  usePicking(rig, onHover);
  useLabels(rig);

  useFrame(({ clock }) => {
    const { knee, hip, layers, selected } = useSimStore.getState();
    rig.update(knee, hip);
    rig.showLayers(layers);
    rig.highlight(selected === null ? null : (structures[selected] ?? null), clock.elapsedTime);
  });

  return <primitive object={rig.root} />;
}

/** HTML labels pinned to the rig's anchors, drawn by three's CSS2DRenderer over the canvas (v0.3). */
function useLabels(rig: ItbsRig) {
  const gl = useThree((s) => s.gl);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const labels = useRef<{
    renderer: CSS2DRenderer;
    items: { object: CSS2DObject; near: boolean }[];
  }>(null);

  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const renderer = new CSS2DRenderer();
    renderer.domElement.className = 'labels';
    host.appendChild(renderer.domElement);
    const items = rig.labelAnchors.flatMap(({ id, object: anchor }) => {
      const spec = LABELS[id];
      if (!spec) return [];
      const el = document.createElement('div');
      el.className = spec.near ? 'lbl lbl-near' : 'lbl';
      el.textContent = spec.text;
      const object = new CSS2DObject(el);
      anchor.add(object);
      return [{ object, near: spec.near }];
    });
    labels.current = { renderer, items };
    return () => {
      for (const { object } of items) {
        object.removeFromParent();
        object.element.remove();
      }
      renderer.domElement.remove();
      labels.current = null;
    };
  }, [gl, rig]);

  useEffect(() => {
    labels.current?.renderer.setSize(width, height);
  }, [width, height]);

  useFrame(({ scene, camera, controls }) => {
    const l = labels.current;
    if (!l) return;
    const target = (controls as OrbitControlsImpl | null)?.target;
    const distance = target ? camera.position.distanceTo(target) : Infinity;
    const on = useSimStore.getState().labels;
    for (const item of l.items) item.object.visible = labelShown(item.near, distance, on);
    l.renderer.render(scene, camera);
  });
}

const HOVER_INTERVAL_MS = 90;

/** Click or tap opens the term under the pointer; an orbit drag does not. Hover reports the term. */
function usePicking(rig: ItbsRig, onHover: Props['onHover']) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    let down: { x: number; y: number } | null = null;
    let latest: PointerEvent | null = null;
    let timer: number | undefined;

    const termUnder = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      // A click can land before the first frame has rendered the camera's matrices.
      camera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);
      return rig.pick(raycaster);
    };
    // Open hand says "drag me", as in v0.3; the pointing hand marks something to click.
    el.style.cursor = 'grab';
    const clearHover = () => {
      latest = null;
      el.style.cursor = 'grab';
      onHover(null, 0, 0);
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      clearHover();
      el.style.cursor = 'grabbing';
    };
    const onUp = (e: PointerEvent) => {
      const click = down !== null && isClick(down, { x: e.clientX, y: e.clientY });
      down = null;
      el.style.cursor = 'grab';
      if (!click) return;
      const term = termUnder(e);
      if (term) useSimStore.getState().select(term);
    };
    // Raycasting skinned meshes walks every vertex, so hover is throttled and skipped mid-drag.
    // The trailing call matters: without it a pointer that stops shows the term it left behind.
    const flushHover = () => {
      timer = undefined;
      const e = latest;
      if (!e) return;
      latest = null;
      const term = termUnder(e);
      el.style.cursor = term ? 'pointer' : 'grab';
      const r = el.getBoundingClientRect();
      onHover(term, e.clientX - r.left, e.clientY - r.top);
      timer = window.setTimeout(flushHover, HOVER_INTERVAL_MS);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || down) return;
      latest = e;
      if (timer === undefined) flushHover();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', clearHover);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', clearHover);
      window.clearTimeout(timer);
    };
  }, [gl, camera, rig, onHover]);
}

function RoomLighting() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

const CAMERA_MOVE_MS = 700;

interface CameraMove {
  fromPosition: Vector3;
  fromTarget: Vector3;
  toPosition: Vector3;
  toTarget: Vector3;
  startMs: number;
}

/**
 * Moves the camera to the preset in the store. Glides on a request, snaps on resize, and stops
 * refitting once the reader orbits (v0.3), until the next preset request.
 */
function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const move = useRef<CameraMove | null>(null);
  const orbited = useRef(false);

  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      orbited.current = true;
      move.current = null;
    };
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [controls]);

  useEffect(() => {
    if (!controls || orbited.current || move.current) return;
    const aspect = width / Math.max(1, height);
    const pose = cameraPose(useSimStore.getState().view.name, FOV, aspect);
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    controls.update();
  }, [camera, controls, width, height]);

  useEffect(() => {
    if (!controls) return;
    return useSimStore.subscribe((state, prev) => {
      if (state.view === prev.view) return;
      const { width: w, height: h } = controls.domElement?.getBoundingClientRect() ?? {
        width,
        height,
      };
      const pose = cameraPose(state.view.name, FOV, w / Math.max(1, h));
      orbited.current = false;
      move.current = {
        fromPosition: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPosition: pose.position,
        toTarget: pose.target,
        startMs: performance.now(),
      };
    });
  }, [camera, controls, width, height]);

  useFrame(() => {
    const m = move.current;
    if (!m || !controls) return;
    const t = Math.min(1, (performance.now() - m.startMs) / CAMERA_MOVE_MS);
    const eased = 1 - (1 - t) ** 3;
    camera.position.lerpVectors(m.fromPosition, m.toPosition, eased);
    controls.target.lerpVectors(m.fromTarget, m.toTarget, eased);
    if (t >= 1) move.current = null;
  });

  return null;
}
