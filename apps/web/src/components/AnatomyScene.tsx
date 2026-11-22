import { type CompressionParams, fitDistance } from '@atlas/sim';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo } from 'react';
import { type PerspectiveCamera, PMREMGenerator, Raycaster, Vector2 } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildItbsRig, FOOT_Y, type ItbsRig, LATERAL_VIEW } from '../scene/itbsRig';
import { isClick } from '../scene/picking';
import { useSimStore } from '../simStore';

interface Props {
  params: CompressionParams;
  /** Term id -> the structure to highlight when that term is open. */
  structures: Readonly<Record<string, string>>;
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
      <LateralCamera />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={420}
        target={LATERAL_VIEW.target}
      />
    </Canvas>
  );
}

function Leg({ params, structures, onReady }: Props) {
  const gltf = useLoader(GLTFLoader, GLB_URL);
  const rig = useMemo(() => buildItbsRig(gltf.scene, params), [gltf, params]);

  useEffect(() => {
    onReady();
    return () => rig.dispose();
  }, [rig, onReady]);

  usePicking(rig);

  useFrame(({ clock }) => {
    const { knee, hip, layers, selected } = useSimStore.getState();
    rig.update(knee, hip);
    rig.showLayers(layers);
    rig.highlight(selected === null ? null : (structures[selected] ?? null), clock.elapsedTime);
  });

  return <primitive object={rig.root} />;
}

const HOVER_INTERVAL_MS = 90;

/** Click or tap opens the term under the pointer; an orbit drag does not. Hover sets the cursor. */
function usePicking(rig: ItbsRig) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    let down: { x: number; y: number } | null = null;
    let lastHover = 0;

    const termUnder = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      // A click can land before the first frame has rendered the camera's matrices.
      camera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);
      return rig.pick(raycaster);
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      const click = down !== null && isClick(down, { x: e.clientX, y: e.clientY });
      down = null;
      if (!click) return;
      const term = termUnder(e);
      if (term) useSimStore.getState().select(term);
    };
    // Raycasting skinned meshes walks every vertex, so hover is throttled and skipped mid-drag.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || down) return;
      if (e.timeStamp - lastHover < HOVER_INTERVAL_MS) return;
      lastHover = e.timeStamp;
      el.style.cursor = termUnder(e) ? 'pointer' : '';
    };
    const onLeave = () => {
      el.style.cursor = '';
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [gl, camera, rig]);
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

// ponytail: fits once on mount; refit on resize when camera presets land (backlog step 2).
function LateralCamera() {
  const camera = useThree((s) => s.camera as PerspectiveCamera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  // biome-ignore lint/correctness/useExhaustiveDependencies: fit only on mount so user orbiting is kept
  useEffect(() => {
    const { target, direction, height, widthRatio } = LATERAL_VIEW;
    const distance = fitDistance(height, widthRatio, FOV, aspect);
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
  }, [camera]);
  return null;
}
