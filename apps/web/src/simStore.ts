import type { Simulation, Term, Tour } from '@atlas/content-schema';
import { advancePhase, gaitAngle } from '@atlas/sim';
import { create } from 'zustand';
import { type Tween, tweenAt } from './tour';

// The scene reads this with getState() in useFrame, so pose changes never re-render the canvas.

/** Toggleable groups of the anatomy scene. Lives here, not in the rig, so the page bundle skips three.js. */
export const LAYERS = ['bone', 'muscle', 'itb', 'fat'] as const;
export type Layer = (typeof LAYERS)[number];
export type LayerVisibility = Readonly<Record<Layer, boolean>>;

export type SceneHint = NonNullable<Term['injuries'][string]['scene']>;
export type CameraView = NonNullable<SceneHint['camera']>;

export type TourEnter = Tour['steps'][number]['enter'];
export type RunMode = NonNullable<TourEnter['mode']>;
type Gait = Simulation['gait'];
type PoseKey = 'knee' | 'hip';
type TweenParam = 'kneeAngle' | 'hipDrop';
const POSE_KEY: Readonly<Record<TweenParam, PoseKey>> = { kneeAngle: 'knee', hipDrop: 'hip' };
// Slider steps: knee 1°, hip 0.5°.
const snap: Readonly<Record<PoseKey, (v: number) => number>> = {
  knee: Math.round,
  hip: (v) => Math.round(v * 2) / 2,
};
/** v0.3 eases into a step's pose over 0.9 s. */
const ENTER_MS = 900;

export interface TourState {
  step: number;
  line: number;
  /** `userPaused`: the reader took a control, so the caption says why it stopped. */
  status: 'playing' | 'paused' | 'userPaused' | 'ended';
}

interface SimState {
  /** Knee flexion (deg). A run mode sets it every frame, so it is not always a whole number. */
  knee: number;
  hip: number;
  layers: LayerVisibility;
  /** Text labels on the model. */
  labels: boolean;
  /** The "Sợi căng" view: ITB fibres coloured by tension. */
  tension: boolean;
  /** Id of the dictionary term open in the panel. */
  selected: string | null;
  /** Term the tour points at. The open term wins over it. */
  highlight: string | null;
  /** Requested camera preset. `seq` counts requests, so asking for the same preset again moves the camera back. */
  view: { name: CameraView; seq: number };
  /** `manual`: the slider sets the knee. Otherwise the knee follows that mode's gait curve. */
  mode: RunMode;
  /** Position in the stride, 0..1. */
  phase: number;
  tour: TourState | null;
  tweens: Partial<Record<PoseKey, Tween>>;
  setKnee: (deg: number) => void;
  setHip: (deg: number) => void;
  toggleLayer: (layer: Layer) => void;
  toggleLabels: () => void;
  toggleTension: () => void;
  select: (term: string | null) => void;
  setView: (name: CameraView) => void;
  /** Open a term and apply its scene hint (camera, knee angle, hip drop). */
  openTerm: (term: string, hint: SceneHint | undefined) => void;
  /** Choosing a run mode starts its stride from foot strike; `manual` stops it. */
  setMode: (mode: RunMode) => void;
  /** Move the stride on by `dtSec` and put the knee on the curve. No-op in manual mode. */
  advanceGait: (dtSec: number, gait: Gait) => void;
  /** Start playing a step from its first line and apply its `enter` state. */
  enterTourStep: (step: number, enter: TourEnter, now: number) => void;
  setTourLine: (line: number) => void;
  setTourStatus: (status: TourState['status']) => void;
  setHighlight: (term: string | null) => void;
  addTween: (param: TweenParam, to: number, ms: number, now: number) => void;
  /** Advance the running tweens to `now`. */
  tick: (now: number) => void;
  /** The reader moved a control: pause a playing tour (v0.3 `tourUserPause`) and drop the tween it fights. */
  userPause: (fights?: PoseKey) => void;
  stopTour: () => void;
  reset: () => void;
}

const neutral = {
  knee: 0,
  hip: 0,
  layers: { bone: true, muscle: true, itb: true, fat: true },
  labels: true,
  tension: false,
  selected: null,
  highlight: null,
  view: { name: 'lateral' as CameraView, seq: 0 },
  mode: 'manual' as RunMode,
  phase: 0,
  tour: null,
  tweens: {},
};

export const useSimStore = create<SimState>()((set, get) => ({
  ...neutral,
  setKnee: (knee) => set({ knee }),
  setHip: (hip) => set({ hip }),
  toggleLayer: (layer) => set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
  toggleLabels: () => set((s) => ({ labels: !s.labels })),
  toggleTension: () => set((s) => ({ tension: !s.tension })),
  select: (selected) => set({ selected }),
  setView: (name) => set((s) => ({ view: { name, seq: s.view.seq + 1 } })),
  openTerm: (selected, hint) =>
    set((s) => ({
      selected,
      ...(hint?.camera && { view: { name: hint.camera, seq: s.view.seq + 1 } }),
      ...(hint?.kneeAngle !== undefined && { knee: hint.kneeAngle, mode: 'manual' }),
      ...(hint?.hipDrop !== undefined && { hip: hint.hipDrop }),
    })),
  // A knee tween would fight the stride, and a stopped stride leaves the knee where it is.
  setMode: (mode) =>
    set((s) => {
      const { knee: _, ...tweens } = s.tweens;
      return { mode, phase: 0, tweens };
    }),
  advanceGait: (dtSec, gait) => {
    const { mode, phase } = get();
    if (mode === 'manual') return;
    const next = advancePhase(phase, dtSec);
    set({ phase: next, knee: gaitAngle(gait[mode].keyframes, next) });
  },
  enterTourStep: (step, enter, now) => {
    if (enter.mode) get().setMode(enter.mode);
    set((s) => ({
      tour: { step, line: 0, status: 'playing' },
      selected: null,
      ...(enter.camera && { view: { name: enter.camera, seq: s.view.seq + 1 } }),
      ...(enter.highlight !== undefined && { highlight: enter.highlight }),
      ...(enter.showTension !== undefined && { tension: enter.showTension }),
    }));
    const { addTween } = get();
    if (enter.kneeAngle !== undefined && get().mode === 'manual')
      addTween('kneeAngle', enter.kneeAngle, ENTER_MS, now);
    if (enter.hipDrop !== undefined) addTween('hipDrop', enter.hipDrop, ENTER_MS, now);
  },
  setTourLine: (line) => set((s) => (s.tour ? { tour: { ...s.tour, line } } : {})),
  setTourStatus: (status) => set((s) => (s.tour ? { tour: { ...s.tour, status } } : {})),
  setHighlight: (highlight) => set({ highlight }),
  addTween: (param, to, ms, now) =>
    set((s) => {
      const key = POSE_KEY[param];
      return { tweens: { ...s.tweens, [key]: { from: s[key], to, t0: now, ms } } };
    }),
  tick: (now) => {
    const { tweens } = get();
    const keys = Object.keys(tweens) as PoseKey[];
    if (keys.length === 0) return;
    const next: Partial<Record<PoseKey, Tween>> = {};
    const pose: Partial<Record<PoseKey, number>> = {};
    for (const key of keys) {
      const tw = tweens[key];
      if (!tw) continue;
      const { value, done } = tweenAt(tw, now);
      pose[key] = snap[key](value);
      if (!done) next[key] = tw;
    }
    set({ ...pose, tweens: next });
  },
  userPause: (fights) =>
    set((s) => {
      const tweens = { ...s.tweens };
      if (fights) delete tweens[fights];
      return s.tour?.status === 'playing'
        ? { tour: { ...s.tour, status: 'userPaused' }, tweens }
        : { tweens };
    }),
  stopTour: () => set({ tour: null, highlight: null, tweens: {} }),
  reset: () => set(neutral),
}));
