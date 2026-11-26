import type { Simulation as SimulationContent, Term, Tour } from '@atlas/content-schema';
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
import { type CameraView, LAYERS, type Layer, useSimStore } from '../simStore';
import { GaitChart, RUN_MODES } from './GaitChart';
import { TermPanel } from './TermPanel';
import { goToStep, TourPlayer } from './Tour';

const AnatomyScene = lazy(() => import('./AnatomyScene'));

// Labels and swatch colours from legacy v0.3.
const LAYER_UI: Readonly<Record<Layer, { label: string; colour: string }>> = {
  bone: { label: 'Xương', colour: '#e8dcc4' },
  muscle: { label: 'Cơ', colour: '#d06a6a' },
  itb: { label: 'Dải chậu chày', colour: '#7cc4f5' },
  fat: { label: 'Lớp mỡ', colour: '#f2cf63' },
};

// Camera preset buttons, labels from legacy v0.3.
const VIEWS: readonly { name: CameraView; label: string }[] = [
  { name: 'lateral', label: 'Mặt ngoài' },
  { name: 'front', label: 'Phía trước' },
  { name: 'knee', label: 'Cận gối' },
  { name: 'hip', label: 'Hông' },
];

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
  tour: Tour;
  /** Terms linked to this injury. */
  terms: readonly Term[];
  injury: { slug: string; name: string };
}

export function Simulation({ sim, tour, terms, injury }: Props) {
  // Reset on unmount so the next injury page starts from the neutral pose without a flash.
  useEffect(() => useSimStore.getState().reset, []);
  // Labels crowd a phone screen, so they start off there (v0.3). After mount: the prerendered
  // HTML cannot know the screen width.
  useEffect(() => {
    if (window.matchMedia('(max-width: 680px)').matches && useSimStore.getState().labels) {
      useSimStore.getState().toggleLabels();
    }
  }, []);

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
    <>
      <div className="viewer">
        <ClientOnly
          fallback={
            <div className="stage" data-testid="sim-placeholder">
              <p className="stage-msg">Đang chuẩn bị mô phỏng 3D…</p>
            </div>
          }
        >
          <Stage sim={sim} tour={tour} structures={structures} terms={termById} />
          <Ticker gait={sim.gait} />
        </ClientOnly>
        <Side sim={sim} tour={tour} terms={termById} injury={injury} />
      </div>
      <GaitChart sim={sim} />
    </>
  );
}

/**
 * One frame loop for the stride and the tour's tweens, outside the canvas so both run without
 * WebGL. It runs only while something moves.
 */
function Ticker({ gait }: { gait: SimulationContent['gait'] }) {
  const moving = useSimStore((s) => s.mode !== 'manual' || s.tour !== null);
  useEffect(() => {
    if (!moving) return;
    let last = performance.now();
    let id = requestAnimationFrame(function frame(now) {
      const sim = useSimStore.getState();
      sim.advanceGait((now - last) / 1000, gait);
      sim.tick(now);
      last = now;
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [moving, gait]);
  return null;
}

function Side({
  sim,
  tour,
  terms,
  injury,
}: Omit<Props, 'terms'> & { terms: ReadonlyMap<string, Term> }) {
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
        <Controls sim={sim} tour={tour} />
      </div>
      <div {...paneProps('entry')}>
        <TermPanel terms={terms} injury={injury} />
      </div>
    </aside>
  );
}

// Only this subtree subscribes to the pose, so dragging a slider never re-renders the stage.
function Controls({ sim, tour }: { sim: SimulationContent; tour: Tour }) {
  const touring = useSimStore((s) => s.tour !== null);
  const knee = useSimStore((s) => Math.round(s.knee));
  const hip = useSimStore((s) => s.hip);
  const mode = useSimStore((s) => s.mode);
  const labels = useSimStore((s) => s.labels);
  const tension = useSimStore((s) => s.tension);
  const layers = useSimStore((s) => s.layers);
  const {
    setKnee,
    setHip,
    setMode,
    toggleLayer,
    toggleLabels,
    toggleTension,
    userPause,
    stopTour,
  } = useSimStore.getState();

  const pressure = Math.round(compression(knee, hip, sim.compression) * 100);
  const { minDeg, maxDeg } = sim.impingementZone;

  return (
    <>
      <button
        type="button"
        className="btn cta"
        onClick={() => {
          if (touring) return stopTour();
          goToStep(tour, 0);
          document
            .querySelector('.stage')
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }}
      >
        {touring ? '■ Dừng thuyết minh' : '▶ Nghe thuyết minh · 3 phút'}
      </button>
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
            onChange={(e) => {
              userPause('knee');
              if (mode !== 'manual') setMode('manual');
              setKnee(e.target.valueAsNumber);
            }}
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
            onChange={(e) => {
              userPause('hip');
              setHip(e.target.valueAsNumber);
            }}
          />
        </label>
      </div>
      <fieldset className="ctl layers">
        <legend>Chế độ chạy</legend>
        {RUN_MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            className="btn"
            aria-pressed={mode === m.mode}
            onClick={() => {
              userPause('knee');
              setMode(m.mode);
            }}
          >
            {m.label}
          </button>
        ))}
      </fieldset>
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
        <button type="button" className="btn" aria-pressed={labels} onClick={toggleLabels}>
          <i className="swatch" style={{ background: '#ffffff' }} aria-hidden />
          Nhãn
        </button>
        <button type="button" className="btn" aria-pressed={tension} onClick={toggleTension}>
          <i className="swatch" style={{ background: '#f5a524' }} aria-hidden />
          Sợi căng
        </button>
      </fieldset>
      <div className="meter">
        <span id="sim-meter-label">Mức ép lớp mỡ (minh họa)</span>
        <meter aria-labelledby="sim-meter-label" min={0} max={100} value={pressure} />
        <strong data-testid="sim-compression">{pressure}%</strong>
      </div>
      <p className="note">{sim.note}</p>
      <p className="note" data-testid="sim-illustration-note">
        Lớp mỡ, sợi Kaplan và mũi tên là phần minh họa thêm, không có trong dữ liệu gốc. Màu "Sợi
        căng" là minh họa định tính, không phải số đo.
      </p>
      <a className="note" href="/legacy/v0.3/index.html">
        Xem bản v0.3
      </a>
    </>
  );
}

/** Camera presets over the scene. Choosing one again brings the camera back after orbiting. */
function ViewButtons() {
  const view = useSimStore((s) => s.view.name);
  const { setView, userPause } = useSimStore.getState();
  return (
    <fieldset className="hud" aria-label="Góc nhìn">
      {VIEWS.map((v) => (
        <button
          key={v.name}
          type="button"
          className="btn"
          aria-pressed={view === v.name}
          onClick={() => {
            userPause();
            setView(v.name);
          }}
        >
          {v.label}
        </button>
      ))}
    </fieldset>
  );
}

/** Knee angle and zone over the scene. Its own subscriber, so the canvas does not re-render. */
function Readout({ sim }: { sim: SimulationContent }) {
  // Rounded in the selector: a run mode changes the knee every frame, the readout only per degree.
  const knee = useSimStore((s) => Math.round(s.knee));
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
  tour,
  structures,
  terms,
}: {
  sim: SimulationContent;
  tour: Tour;
  structures: Readonly<Record<string, string>>;
  terms: ReadonlyMap<string, Term>;
}) {
  const [state, setState] = useState<StageState>('loading');
  const ready = useCallback(() => setState('ready'), []);
  const failed = useCallback(() => setState('error'), []);
  const tip = useRef<HTMLDivElement>(null);
  const touring = useSimStore((s) => s.tour !== null);

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
    <div
      className="stage"
      data-testid="sim-stage"
      data-state={state}
      data-touring={touring || undefined}
    >
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
      <ViewButtons />
      <Readout sim={sim} />
      <p className="stage-hint">
        Kéo để xoay · Shift, chuột phải hoặc hai ngón để dời · Cuộn/chụm để phóng to · Bấm vào cấu
        trúc để xem mục từ
      </p>
      <div className="tip" ref={tip} role="tooltip" data-testid="sim-tip" hidden />
      <TourPlayer tour={tour} />
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
