import { create } from 'zustand';

// The scene reads this with getState() in useFrame, so pose changes never re-render the canvas.
// ponytail: selection, run mode and tour join when their features land.

/** Toggleable groups of the anatomy scene. Lives here, not in the rig, so the page bundle skips three.js. */
export const LAYERS = ['bone', 'muscle', 'itb', 'fat'] as const;
export type Layer = (typeof LAYERS)[number];
export type LayerVisibility = Readonly<Record<Layer, boolean>>;

interface SimState {
  knee: number;
  hip: number;
  layers: LayerVisibility;
  setKnee: (deg: number) => void;
  setHip: (deg: number) => void;
  toggleLayer: (layer: Layer) => void;
  reset: () => void;
}

const neutral = {
  knee: 0,
  hip: 0,
  layers: { bone: true, muscle: true, itb: true, fat: true },
};

export const useSimStore = create<SimState>()((set) => ({
  ...neutral,
  setKnee: (knee) => set({ knee }),
  setHip: (hip) => set({ hip }),
  toggleLayer: (layer) => set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
  reset: () => set(neutral),
}));
