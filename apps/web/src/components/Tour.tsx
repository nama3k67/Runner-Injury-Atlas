import type { Tour } from '@atlas/content-schema';
import { useEffect, useState } from 'react';
import { useSimStore } from '../simStore';
import { afterLine, pickVietnameseVoice, previousStep, readingMs } from '../tour';

// Captions always show: devices without a Vietnamese voice advance them on a timer (#17).
// ponytail: v0.3's reading-rate button and clickable step dots are left out; add if readers ask.

const END_TEXT = 'Hết phần thuyết minh. Bấm ⏮ để nghe lại, hoặc ✕ để tự khám phá.';
const USER_PAUSE_TEXT = 'Đã tạm dừng vì bạn đang tự điều khiển. Bấm ▶ để nghe tiếp.';
const NO_VOICE_TEXT =
  'Thiết bị này chưa có giọng đọc tiếng Việt, nên trang đang chạy phụ đề tự động. Cài giọng "Tiếng Việt" trong phần cài đặt giọng nói của hệ điều hành để nghe được.';
// Pauses from v0.3: after a line, and before the next step.
const LINE_GAP_MS = 280;
const STEP_GAP_MS = 700;

const vietnameseVoice = (): SpeechSynthesisVoice | null =>
  typeof speechSynthesis === 'undefined' ? null : pickVietnameseVoice(speechSynthesis.getVoices());

/** Play step `i` (clamped) from its first line. */
export const goToStep = (tour: Tour, i: number) => {
  const step = Math.max(0, Math.min(tour.steps.length - 1, i));
  const enter = tour.steps[step]?.enter;
  if (enter) useSimStore.getState().enterTourStep(step, enter, performance.now());
};

export function TourPlayer({ tour }: { tour: Tour }) {
  const state = useSimStore((s) => s.tour);
  const on = state !== null;
  const step = state?.step;
  const line = state?.line;
  const status = state?.status;
  const [noVoiceNote, setNoVoiceNote] = useState(false);

  useEffect(() => {
    if (!on || vietnameseVoice()) return;
    setNoVoiceNote(true);
    const t = setTimeout(() => setNoVoiceNote(false), 9000);
    return () => clearTimeout(t);
  }, [on]);

  useEffect(() => {
    if (!on) return;
    const hide = () => {
      if (document.hidden && useSimStore.getState().tour?.status === 'playing')
        useSimStore.getState().setTourStatus('paused');
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [on]);

  // Read the current line, then move on. Pausing, stopping or moving re-runs this, and the
  // cleanup silences the old line.
  useEffect(() => {
    if (step === undefined || line === undefined || status !== 'playing') return;
    const text = tour.steps[step]?.lines[line];
    if (!text) return;
    const sim = useSimStore.getState();
    const now = performance.now();
    for (const a of text.actions ?? []) {
      if (a.type === 'highlight') sim.setHighlight(a.structure);
      else sim.addTween(a.param, a.to, a.ms, now);
    }

    const next = afterLine(tour, { step, line });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    const move = () => {
      const s = useSimStore.getState();
      if (next === 'end') s.setTourStatus('ended');
      else if (next.step === step) s.setTourLine(next.line);
      else goToStep(tour, next.step);
    };
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const gap = next !== 'end' && next.step !== step ? LINE_GAP_MS + STEP_GAP_MS : LINE_GAP_MS;
      timer = setTimeout(move, gap);
    };

    const voice = vietnameseVoice();
    if (voice) {
      const u = new SpeechSynthesisUtterance(text.text);
      u.lang = voice.lang;
      u.voice = voice;
      u.onend = done;
      u.onerror = done;
      speechSynthesis.speak(u);
      // Some engines never fire `end` (v0.3 safety timer).
      timer = setTimeout(done, readingMs(text.text) * 2.4 + 4000);
    } else {
      timer = setTimeout(done, readingMs(text.text));
    }
    return () => {
      finished = true;
      clearTimeout(timer);
      if (voice) speechSynthesis.cancel();
    };
  }, [tour, step, line, status]);

  if (!state) return null;
  const current = tour.steps[state.step];
  const playing = state.status === 'playing';
  const caption =
    state.status === 'ended'
      ? END_TEXT
      : state.status === 'userPaused'
        ? USER_PAUSE_TEXT
        : current?.lines[state.line]?.text;
  const { stopTour, setTourStatus } = useSimStore.getState();
  const toggle = () => {
    if (state.status === 'ended') goToStep(tour, 0);
    else setTourStatus(playing ? 'paused' : 'playing');
  };

  return (
    // Escape is a shortcut; every action also has a button.
    <section
      className="tour"
      aria-label="Thuyết minh"
      data-testid="tour"
      onKeyDown={(e) => {
        if (e.key === 'Escape') stopTour();
      }}
    >
      {noVoiceNote && <p className="tour-note">{NO_VOICE_TEXT}</p>}
      <p className="tour-cap" aria-live="polite" data-testid="tour-caption">
        {caption}
      </p>
      <div className="tour-bar">
        <button
          type="button"
          className="btn"
          aria-label="Đoạn trước"
          title="Đoạn trước"
          onClick={() => goToStep(tour, previousStep(state))}
        >
          ⏮
        </button>
        <button
          type="button"
          className="btn"
          aria-label={playing ? 'Tạm dừng' : 'Tiếp tục'}
          title={playing ? 'Tạm dừng' : 'Tiếp tục'}
          onClick={toggle}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          className="btn"
          aria-label="Đoạn sau"
          title="Đoạn sau"
          onClick={() => goToStep(tour, state.step + 1)}
        >
          ⏭
        </button>
        <ol className="tour-dots" aria-hidden>
          {tour.steps.map((s, i) => (
            <li
              key={s.id}
              className={i < state.step ? 'done' : i === state.step ? 'cur' : undefined}
            />
          ))}
        </ol>
        <span className="tour-title" data-testid="tour-title">
          {state.step + 1}/{tour.steps.length} · {current?.title}
        </span>
        <button
          type="button"
          className="btn"
          aria-label="Thoát thuyết minh"
          title="Thoát thuyết minh"
          onClick={stopTour}
        >
          ✕
        </button>
      </div>
    </section>
  );
}
