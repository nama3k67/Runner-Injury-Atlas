import type { Term } from '@atlas/content-schema';
import { create } from 'zustand';

// The scene reads this with getState() in useFrame, so pose changes never re-render the canvas.
// ponytail: run mode and tour join when their features land.

/** Toggleable groups of the anatomy scene. Lives here, not in the rig, so the page bundle skips three.js. */
export const LAYERS = ['bone', 'muscle', 'itb', 'fat'] as const;
export type Layer = (typeof LAYERS)[number];
export type LayerVisibility = Readonly<Record<Layer, boolean>>;

export type SceneHint = NonNullable<Term['injuries'][string]['scene']>;
export type CameraView = NonNullable<SceneHint['camera']>;

interface SimState {
  knee: number;
  hip: number;
  layers: LayerVisibility;
  /** Id of the dictionary term open in the panel. */
  selected: string | null;
  /** Requested camera preset. `seq` counts requests, so asking for the same preset again moves the camera back. */
  view: { name: CameraView; seq: number };
  setKnee: (deg: number) => void;
  setHip: (deg: number) => void;
  toggleLayer: (layer: Layer) => void;
  select: (term: string | null) => void;
  setView: (name: CameraView) => void;
  /** Open a term and apply its scene hint (camera, knee angle, hip drop). */
  openTerm: (term: string, hint: SceneHint | undefined) => void;
  reset: () => void;
}

const neutral = {
  knee: 0,
  hip: 0,
  layers: { bone: true, muscle: true, itb: true, fat: true },
  selected: null,
  view: { name: 'lateral' as CameraView, seq: 0 },
};

export const useSimStore = create<SimState>()((set) => ({
  ...neutral,
  setKnee: (knee) => set({ knee }),
  setHip: (hip) => set({ hip }),
  toggleLayer: (layer) => set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
  select: (selected) => set({ selected }),
  setView: (name) => set((s) => ({ view: { name, seq: s.view.seq + 1 } })),
  openTerm: (selected, hint) =>
    set((s) => ({
      selected,
      ...(hint?.camera && { view: { name: hint.camera, seq: s.view.seq + 1 } }),
      ...(hint?.kneeAngle !== undefined && { knee: hint.kneeAngle }),
      ...(hint?.hipDrop !== undefined && { hip: hint.hipDrop }),
    })),
  reset: () => set(neutral),
}));
