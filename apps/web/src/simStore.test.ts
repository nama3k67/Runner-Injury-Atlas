import { describe, expect, it } from 'vitest';
import { useSimStore } from './simStore';

const allOn = { bone: true, muscle: true, itb: true, fat: true };

describe('useSimStore', () => {
  it('sets knee and hip, and reset returns to the neutral pose', () => {
    const { setKnee, setHip, reset } = useSimStore.getState();
    setKnee(25);
    setHip(4.5);
    expect(useSimStore.getState()).toMatchObject({ knee: 25, hip: 4.5 });

    reset();
    expect(useSimStore.getState()).toMatchObject({ knee: 0, hip: 0 });
  });

  it('starts with every layer on, toggles one at a time, and reset turns them back on', () => {
    const { toggleLayer, reset } = useSimStore.getState();
    expect(useSimStore.getState().layers).toEqual(allOn);

    toggleLayer('muscle');
    expect(useSimStore.getState().layers).toEqual({ ...allOn, muscle: false });
    toggleLayer('muscle');
    expect(useSimStore.getState().layers).toEqual(allOn);

    toggleLayer('fat');
    reset();
    expect(useSimStore.getState().layers).toEqual(allOn);
  });
});
