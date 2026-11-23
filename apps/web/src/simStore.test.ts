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

  it('selects one term at a time, clears it, and reset clears it', () => {
    const { select, reset } = useSimStore.getState();
    expect(useSimStore.getState().selected).toBeNull();

    select('femur');
    select('kaplan');
    expect(useSimStore.getState().selected).toBe('kaplan');
    select(null);
    expect(useSimStore.getState().selected).toBeNull();

    select('itb');
    reset();
    expect(useSimStore.getState().selected).toBeNull();
  });

  it('counts every view request, so asking for the current preset again still moves the camera', () => {
    const { setView, reset } = useSimStore.getState();
    expect(useSimStore.getState().view).toEqual({ name: 'lateral', seq: 0 });
    setView('knee');
    setView('knee');
    expect(useSimStore.getState().view).toEqual({ name: 'knee', seq: 2 });
    reset();
    expect(useSimStore.getState().view).toEqual({ name: 'lateral', seq: 0 });
  });

  it('opening a term applies its scene hint, and only the parts the hint has', () => {
    const { openTerm, setKnee, setHip, reset } = useSimStore.getState();
    setKnee(10);
    setHip(2);

    openTerm('fatpad', { structure: 'fatpad', camera: 'knee', kneeAngle: 25 });
    expect(useSimStore.getState()).toMatchObject({
      selected: 'fatpad',
      view: { name: 'knee', seq: 1 },
      knee: 25,
      hip: 2,
    });

    openTerm('gmed', { camera: 'hip', hipDrop: 7 });
    expect(useSimStore.getState()).toMatchObject({
      view: { name: 'hip', seq: 2 },
      knee: 25,
      hip: 7,
    });

    openTerm('cadence', undefined);
    expect(useSimStore.getState()).toMatchObject({
      selected: 'cadence',
      view: { seq: 2 },
      knee: 25,
    });
    reset();
  });

  it('starts with labels on, toggles them, and reset turns them back on', () => {
    const { toggleLabels, reset } = useSimStore.getState();
    expect(useSimStore.getState().labels).toBe(true);
    toggleLabels();
    expect(useSimStore.getState().labels).toBe(false);
    reset();
    expect(useSimStore.getState().labels).toBe(true);
  });

  it('starts with the fibre tension view off, toggles it, and reset turns it off', () => {
    const { toggleTension, reset } = useSimStore.getState();
    expect(useSimStore.getState().tension).toBe(false);
    toggleTension();
    expect(useSimStore.getState().tension).toBe(true);
    reset();
    expect(useSimStore.getState().tension).toBe(false);
  });
});
