import { type CompressionParams, fitDistance } from '@atlas/sim';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { type RefObject, Suspense, useEffect, useMemo } from 'react';
import { type PerspectiveCamera, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildItbsRig, FOOT_Y, LATERAL_VIEW } from '../scene/itbsRig';

export interface Pose {
  knee: number;
  hip: number;
}

interface Props {
  pose: RefObject<Pose>;
  params: CompressionParams;
  onReady: () => void;
}

const GLB_URL = '/anatomy/leg-right.glb';
const FOV = 30;

export default function AnatomyScene({ pose, params, onReady }: Props) {
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
        <Leg pose={pose} params={params} onReady={onReady} />
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

function Leg({ pose, params, onReady }: Props) {
  const gltf = useLoader(GLTFLoader, GLB_URL);
  const rig = useMemo(() => buildItbsRig(gltf.scene, params), [gltf, params]);

  useEffect(() => {
    onReady();
    return () => rig.dispose();
  }, [rig, onReady]);

  useFrame(() => rig.update(pose.current.knee, pose.current.hip));

  return <primitive object={rig.root} />;
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
