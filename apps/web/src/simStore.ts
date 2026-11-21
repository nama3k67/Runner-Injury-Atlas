import { create } from 'zustand';

// The scene reads this with getState() in useFrame, so pose changes never re-render the canvas.
// ponytail: knee and hip only; selection, run mode and tour join when their features land.
interface SimState {
  knee: number;
  hip: number;
  setKnee: (deg: number) => void;
  setHip: (deg: number) => void;
  reset: () => void;
}

const neutral = { knee: 0, hip: 0 };

export const useSimStore = create<SimState>()((set) => ({
  ...neutral,
  setKnee: (knee) => set({ knee }),
  setHip: (hip) => set({ hip }),
  reset: () => set(neutral),
}));
