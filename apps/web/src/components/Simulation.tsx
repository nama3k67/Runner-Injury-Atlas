import type { Simulation as SimulationContent } from '@atlas/content-schema';
import { compression, inZone } from '@atlas/sim';
import { ClientOnly } from '@tanstack/react-router';
import { Component, lazy, type ReactNode, Suspense, useCallback, useEffect, useState } from 'react';
import { useSimStore } from '../simStore';

const AnatomyScene = lazy(() => import('./AnatomyScene'));

type StageState = 'loading' | 'ready' | 'error';

const hasWebGL = (): boolean => {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
};

export function Simulation({ sim }: { sim: SimulationContent }) {
  // Reset on unmount so the next injury page starts from the neutral pose without a flash.
  useEffect(() => useSimStore.getState().reset, []);

  return (
    <div className="sim">
      <ClientOnly
        fallback={
          <div className="stage" data-testid="sim-placeholder">
            <p className="stage-msg">Đang chuẩn bị mô phỏng 3D…</p>
          </div>
        }
      >
        <Stage sim={sim} />
      </ClientOnly>
      <Controls sim={sim} />
    </div>
  );
}

// Only this subtree subscribes to the pose, so dragging a slider never re-renders the stage.
function Controls({ sim }: { sim: SimulationContent }) {
  const knee = useSimStore((s) => s.knee);
  const hip = useSimStore((s) => s.hip);
  const { setKnee, setHip } = useSimStore.getState();

  const c = compression(knee, hip, sim.compression);
  const hot = inZone(knee, sim.impingementZone);

  return (
    <div className="sim-controls">
      <label>
        Góc gập gối <span data-testid="sim-knee">{knee}°</span>
        <input
          type="range"
          min={0}
          max={90}
          step={1}
          value={knee}
          onChange={(e) => setKnee(e.target.valueAsNumber)}
        />
      </label>
      <label>
        Độ sụp hông bên đối diện <span>{hip}°</span>
        <input
          type="range"
          min={0}
          max={sim.compression.hipDropMaxDeg}
          step={0.5}
          value={hip}
          onChange={(e) => setHip(e.target.valueAsNumber)}
        />
      </label>
      <p className="sim-readout">
        <span className={hot ? 'zone hot' : 'zone'} data-testid="sim-zone">
          {hot ? 'TRONG VÙNG ÉP' : 'Ngoài vùng ép'}
        </span>
        Mức ép lớp mỡ (minh họa):{' '}
        <strong data-testid="sim-compression">{Math.round(c * 100)}%</strong>
      </p>
      <p className="note">{sim.note}</p>
      <a href="/legacy/v0.3/index.html">Xem bản v0.3</a>
    </div>
  );
}

function Stage({ sim }: { sim: SimulationContent }) {
  const [state, setState] = useState<StageState>('loading');
  const ready = useCallback(() => setState('ready'), []);
  const failed = useCallback(() => setState('error'), []);

  useEffect(() => {
    if (!hasWebGL()) failed();
  }, [failed]);

  return (
    <div className="stage" data-testid="sim-stage" data-state={state}>
      {state !== 'error' && (
        <SceneBoundary onError={failed}>
          <Suspense fallback={null}>
            <AnatomyScene params={sim.compression} onReady={ready} />
          </Suspense>
        </SceneBoundary>
      )}
      {state === 'loading' && <p className="stage-msg">Đang tải mô hình giải phẫu…</p>}
      {state === 'error' && (
        <p className="stage-msg" role="alert">
          Không tải được mô hình 3D trên trình duyệt này. Hãy thử Chrome, Edge hoặc Safari bản mới.
        </p>
      )}
    </div>
  );
}

class SceneBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error(error);
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
