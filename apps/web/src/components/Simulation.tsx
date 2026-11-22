import type { Simulation as SimulationContent, Term } from '@atlas/content-schema';
import { compression, inZone } from '@atlas/sim';
import { ClientOnly } from '@tanstack/react-router';
import {
  Component,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LAYERS, type Layer, useSimStore } from '../simStore';
import { TermPanel } from './TermPanel';

const AnatomyScene = lazy(() => import('./AnatomyScene'));

// Labels and swatch colours from legacy v0.3.
const LAYER_UI: Readonly<Record<Layer, { label: string; colour: string }>> = {
  bone: { label: 'Xương', colour: '#e8dcc4' },
  muscle: { label: 'Cơ', colour: '#d06a6a' },
  itb: { label: 'Dải chậu chày', colour: '#7cc4f5' },
  fat: { label: 'Lớp mỡ', colour: '#f2cf63' },
};

const KNEE_MAX_DEG = 90;

type StageState = 'loading' | 'ready' | 'error';
type Tab = 'controls' | 'entry';

const hasWebGL = (): boolean => {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
};

interface Props {
  sim: SimulationContent;
  /** Terms linked to this injury. */
  terms: readonly Term[];
  injury: { slug: string; name: string };
}

export function Simulation({ sim, terms, injury }: Props) {
  // Reset on unmount so the next injury page starts from the neutral pose without a flash.
  useEffect(() => useSimStore.getState().reset, []);

  const termById = useMemo(() => new Map(terms.map((t) => [t.id, t])), [terms]);
  const structures = useMemo(() => {
    const out: Record<string, string> = {};
    for (const t of terms) {
      const structure = t.injuries[injury.slug]?.scene?.structure;
      if (structure) out[t.id] = structure;
    }
    return out;
  }, [terms, injury.slug]);

  return (
    <div className="viewer">
      <ClientOnly
        fallback={
          <div className="stage" data-testid="sim-placeholder">
            <p className="stage-msg">Đang chuẩn bị mô phỏng 3D…</p>
          </div>
        }
      >
        <Stage sim={sim} structures={structures} terms={termById} />
      </ClientOnly>
      <Side sim={sim} terms={termById} injury={injury} />
    </div>
  );
}

function Side({ sim, terms, injury }: Omit<Props, 'terms'> & { terms: ReadonlyMap<string, Term> }) {
  const [tab, setTab] = useState<Tab>('controls');
  const selected = useSimStore((s) => s.selected);
  useEffect(() => {
    if (selected !== null) setTab('entry');
  }, [selected]);

  const tabProps = (id: Tab) => ({
    id: `sim-tab-${id}`,
    role: 'tab',
    type: 'button' as const,
    'aria-selected': tab === id,
    'aria-controls': `sim-pane-${id}`,
    onClick: () => setTab(id),
  });
  const paneProps = (id: Tab) => ({
    id: `sim-pane-${id}`,
    role: 'tabpanel',
    'aria-labelledby': `sim-tab-${id}`,
    className: 'pane',
    hidden: tab !== id,
  });

  return (
    <aside className="side">
      <div className="tabs" role="tablist" aria-label="Bảng mô phỏng">
        <button {...tabProps('controls')}>Điều khiển</button>
        <button {...tabProps('entry')}>Mục từ</button>
      </div>
      <div {...paneProps('controls')}>
        <Controls sim={sim} />
      </div>
      <div {...paneProps('entry')}>
        <TermPanel terms={terms} injury={injury} />
      </div>
    </aside>
  );
}

// Only this subtree subscribes to the pose, so dragging a slider never re-renders the stage.
function Controls({ sim }: { sim: SimulationContent }) {
  const knee = useSimStore((s) => s.knee);
  const hip = useSimStore((s) => s.hip);
  const layers = useSimStore((s) => s.layers);
  const { setKnee, setHip, toggleLayer } = useSimStore.getState();

  const pressure = Math.round(compression(knee, hip, sim.compression) * 100);
  const { minDeg, maxDeg } = sim.impingementZone;

  return (
    <>
      <div className="ctl">
        <label>
          <span className="ctl-head">
            Góc gập gối <span data-testid="sim-knee">{knee}°</span>
          </span>
          <input
            type="range"
            min={0}
            max={KNEE_MAX_DEG}
            step={1}
            value={knee}
            onChange={(e) => setKnee(e.target.valueAsNumber)}
          />
        </label>
        <div className="zonebar" aria-hidden>
          <i
            style={{
              left: `${(minDeg / KNEE_MAX_DEG) * 100}%`,
              width: `${((maxDeg - minDeg) / KNEE_MAX_DEG) * 100}%`,
            }}
          />
        </div>
        <p className="ctl-sub">
          Vùng đỏ: vùng ép {minDeg}–{maxDeg}°
        </p>
      </div>
      <div className="ctl">
        <label>
          <span className="ctl-head">
            Độ sụp hông bên đối diện <span>{hip}°</span>
          </span>
          <input
            type="range"
            min={0}
            max={sim.compression.hipDropMaxDeg}
            step={0.5}
            value={hip}
            onChange={(e) => setHip(e.target.valueAsNumber)}
          />
        </label>
      </div>
      <fieldset className="ctl layers">
        <legend>Lớp hiển thị</legend>
        {LAYERS.map((layer) => (
          <button
            key={layer}
            type="button"
            className="btn"
            aria-pressed={layers[layer]}
            onClick={() => toggleLayer(layer)}
          >
            <i className="swatch" style={{ background: LAYER_UI[layer].colour }} aria-hidden />
            {LAYER_UI[layer].label}
          </button>
        ))}
      </fieldset>
      <div className="meter">
        <span id="sim-meter-label">Mức ép lớp mỡ (minh họa)</span>
        <meter aria-labelledby="sim-meter-label" min={0} max={100} value={pressure} />
        <strong data-testid="sim-compression">{pressure}%</strong>
      </div>
      <p className="note">{sim.note}</p>
      <p className="note" data-testid="sim-illustration-note">
        Lớp mỡ, sợi Kaplan và mũi tên là phần minh họa thêm, không có trong dữ liệu gốc.
      </p>
      <a className="note" href="/legacy/v0.3/index.html">
        Xem bản v0.3
      </a>
    </>
  );
}

/** Knee angle and zone over the scene. Its own subscriber, so the canvas does not re-render. */
function Readout({ sim }: { sim: SimulationContent }) {
  const knee = useSimStore((s) => s.knee);
  const hot = inZone(knee, sim.impingementZone);
  return (
    <div className="readout">
      <div className="readout-angle">{knee}°</div>
      <div className={hot ? 'readout-zone hot' : 'readout-zone'} data-testid="sim-zone">
        {hot ? 'TRONG VÙNG ÉP' : 'Ngoài vùng ép'}
      </div>
    </div>
  );
}

function Stage({
  sim,
  structures,
  terms,
}: {
  sim: SimulationContent;
  structures: Readonly<Record<string, string>>;
  terms: ReadonlyMap<string, Term>;
}) {
  const [state, setState] = useState<StageState>('loading');
  const ready = useCallback(() => setState('ready'), []);
  const failed = useCallback(() => setState('error'), []);
  const tip = useRef<HTMLDivElement>(null);

  // Written straight to the DOM: hover fires many times a second and must not re-render the canvas.
  const hover = useCallback(
    (term: string | null, x: number, y: number) => {
      const el = tip.current;
      if (!el) return;
      const name = term === null ? undefined : terms.get(term)?.vi;
      el.hidden = name === undefined;
      if (name === undefined) return;
      el.textContent = name;
      el.style.transform = `translate(${x + 14}px, ${y + 10}px)`;
    },
    [terms],
  );

  useEffect(() => {
    if (!hasWebGL()) failed();
  }, [failed]);

  return (
    <div className="stage" data-testid="sim-stage" data-state={state}>
      {state !== 'error' && (
        <SceneBoundary onError={failed}>
          <Suspense fallback={null}>
            <AnatomyScene
              params={sim.compression}
              structures={structures}
              onHover={hover}
              onReady={ready}
            />
          </Suspense>
        </SceneBoundary>
      )}
      <Readout sim={sim} />
      <p className="stage-hint">
        Kéo để xoay · Cuộn/chụm để phóng to · Bấm vào cấu trúc để xem mục từ
      </p>
      <div className="tip" ref={tip} role="tooltip" data-testid="sim-tip" hidden />
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
