import type { Simulation } from '@atlas/content-schema';
import { sampleGait } from '@atlas/sim';
import { type RunMode, useSimStore } from '../simStore';
import { Inline } from './RichText';

type Gait = Simulation['gait'];
type GaitMode = keyof Gait;

// Labels and colours from legacy v0.3.
export const RUN_MODES: readonly { mode: RunMode; label: string }[] = [
  { mode: 'manual', label: 'Tay' },
  { mode: 'flat', label: 'Đường phẳng' },
  { mode: 'down', label: 'Xuống dốc' },
  { mode: 'fast', label: 'Chạy nhanh' },
];
const COLOUR: Readonly<Record<GaitMode, string>> = {
  flat: '#7cc4f5',
  down: '#f5a524',
  fast: '#34d399',
};
const GAIT_MODES = ['flat', 'down', 'fast'] as const satisfies readonly GaitMode[];
const label = (m: RunMode) => RUN_MODES.find((r) => r.mode === m)?.label ?? m;

// The SVG stretches to the box (preserveAspectRatio="none"), so text and dots are HTML laid
// over it in percent; they would be squashed inside the SVG on a phone.
const DEG_MAX = 130;
const X = (phase: number) => 5 + phase * 93;
const Y = (deg: number) => 94 - (deg / DEG_MAX) * 86;
const GRID = [0, 30, 60, 90, 120];
const pct = (n: number) => `${n.toFixed(2)}%`;

export function GaitChart({ sim }: { sim: Simulation }) {
  const mode = useSimStore((s) => s.mode);
  const active = mode === 'manual' ? null : mode;
  const { minDeg, maxDeg } = sim.impingementZone;

  return (
    <figure className="gait" data-testid="gait-chart" data-mode={mode}>
      <figcaption className="gait-head">
        <h3>Góc gối trong một chu kỳ bước chạy</h3>
        <span className="note">{sim.note}</span>
      </figcaption>
      <ul className="gait-legend">
        {GAIT_MODES.map((m) => (
          <li key={m}>
            <i style={{ background: COLOUR[m] }} aria-hidden />
            {label(m)}
          </li>
        ))}
      </ul>
      <div className="gait-plot">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Góc gối theo chu kỳ bước chạy của ba chế độ chạy, với vùng ép tô đỏ"
        >
          <rect
            x={X(0)}
            y={Y(maxDeg)}
            width={X(1) - X(0)}
            height={Y(minDeg) - Y(maxDeg)}
            fill="rgba(239, 68, 68, 0.18)"
          />
          {GRID.map((d) => (
            <line key={d} x1={X(0)} x2={X(1)} y1={Y(d)} y2={Y(d)} stroke="#1c2a42" />
          ))}
          {active && (
            <rect
              x={X(0)}
              y={Y(DEG_MAX)}
              width={X(sim.gait[active].stanceEnd) - X(0)}
              height={Y(0) - Y(DEG_MAX)}
              fill="rgba(255, 255, 255, 0.05)"
              data-testid="gait-stance"
            />
          )}
          {GAIT_MODES.map((m) => {
            const on = m === active;
            const d = sampleGait(sim.gait[m].keyframes, 200)
              .map((p, i) => `${i ? 'L' : 'M'}${X(p.phase).toFixed(2)},${Y(p.deg).toFixed(2)}`)
              .join('');
            return (
              <path
                key={m}
                d={d}
                fill="none"
                stroke={COLOUR[m]}
                strokeWidth={on ? 3 : 1.2}
                opacity={on ? 1 : active ? 0.18 : 0.55}
                vectorEffect="non-scaling-stroke"
                data-mode={m}
                data-active={on || undefined}
              />
            );
          })}
        </svg>
        {GRID.map((d) => (
          <span key={d} className="gait-tick" style={{ top: pct(Y(d)) }}>
            {d}°
          </span>
        ))}
        <span className="gait-zone" style={{ left: pct(X(1)), top: pct(Y(maxDeg)) }}>
          vùng ép {minDeg}–{maxDeg}°
        </span>
        {active && (
          <>
            <span
              className="gait-phase"
              style={{ left: pct(X(sim.gait[active].stanceEnd / 2)), top: pct(Y(DEG_MAX)) }}
            >
              Pha chạm đất (chịu lực)
            </span>
            <span
              className="gait-phase dim"
              style={{ left: pct(X((1 + sim.gait[active].stanceEnd) / 2)), top: pct(Y(DEG_MAX)) }}
            >
              Pha bay
            </span>
            <TouchDown deg={sim.gait[active].keyframes[0]?.deg ?? 0} colour={COLOUR[active]} />
            <CurrentPoint />
          </>
        )}
      </div>
      <p className="gait-msg" data-testid="gait-msg">
        {active ? (
          <Inline text={sim.gait[active].explanation} />
        ) : (
          'Chọn một chế độ chạy để xem gối đi qua vùng ép lúc nào.'
        )}
      </p>
    </figure>
  );
}

function TouchDown({ deg, colour }: { deg: number; colour: string }) {
  return (
    <>
      <i className="gait-dot" style={{ left: pct(X(0)), top: pct(Y(deg)), background: colour }} />
      <span className="gait-touch" style={{ left: pct(X(0)), top: pct(Y(deg)), color: colour }}>
        tiếp đất ~{deg}°
      </span>
    </>
  );
}

/** Where the knee is in the stride now. Its own subscriber, so the curves do not re-render. */
function CurrentPoint() {
  const phase = useSimStore((s) => s.phase);
  const knee = useSimStore((s) => s.knee);
  return (
    <i
      className="gait-dot now"
      data-testid="gait-now"
      style={{ left: pct(X(phase)), top: pct(Y(knee)) }}
    />
  );
}
