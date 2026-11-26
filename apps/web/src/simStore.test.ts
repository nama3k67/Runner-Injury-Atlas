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

  describe('tour', () => {
    it('entering a step applies its camera, highlight and tension, and tweens only the pose it sets', () => {
      const { setKnee, setHip, select, enterTourStep, tick, reset } = useSimStore.getState();
      setKnee(30);
      setHip(3);
      select('femur');

      enterTourStep(2, { camera: 'knee', kneeAngle: 0, highlight: 'kaplan', showTension: true }, 0);
      expect(useSimStore.getState()).toMatchObject({
        tour: { step: 2, line: 0, status: 'playing' },
        view: { name: 'knee', seq: 1 },
        highlight: 'kaplan',
        selected: null,
        tension: true,
        knee: 30,
        hip: 3,
      });
      tick(450);
      expect(useSimStore.getState().knee).toBe(15);
      tick(900);
      expect(useSimStore.getState()).toMatchObject({ knee: 0, hip: 3, tweens: {} });

      // A step without a highlight key keeps the current one; null clears it.
      enterTourStep(3, {}, 1000);
      expect(useSimStore.getState()).toMatchObject({ highlight: 'kaplan', view: { seq: 1 } });
      enterTourStep(4, { highlight: null }, 1000);
      expect(useSimStore.getState().highlight).toBeNull();
      reset();
    });

    it('rounds tweened values to the slider steps', () => {
      const { addTween, tick, reset } = useSimStore.getState();
      addTween('kneeAngle', 25, 1000, 0);
      addTween('hipDrop', 8, 1000, 0);
      tick(333);
      const { knee, hip } = useSimStore.getState();
      expect(Number.isInteger(knee)).toBe(true);
      expect(Number.isInteger(hip * 2)).toBe(true);
      reset();
    });

    it('a reader control pauses a playing tour and cancels the tween it fights', () => {
      const { enterTourStep, addTween, userPause, reset } = useSimStore.getState();
      enterTourStep(0, {}, 0);
      addTween('kneeAngle', 60, 1000, 0);
      addTween('hipDrop', 6, 1000, 0);

      userPause('knee');
      expect(useSimStore.getState().tour?.status).toBe('userPaused');
      expect(Object.keys(useSimStore.getState().tweens)).toEqual(['hip']);

      // Paused or not touring: nothing to pause.
      useSimStore.getState().setTourStatus('paused');
      userPause();
      expect(useSimStore.getState().tour?.status).toBe('paused');
      reset();
      userPause();
      expect(useSimStore.getState().tour).toBeNull();
    });

    it('stopping clears the tour, its highlight and its tweens, and keeps the pose', () => {
      const { enterTourStep, addTween, setKnee, stopTour, reset } = useSimStore.getState();
      enterTourStep(1, { highlight: 'itb' }, 0);
      addTween('hipDrop', 6, 1000, 0);
      setKnee(40);
      stopTour();
      expect(useSimStore.getState()).toMatchObject({
        tour: null,
        highlight: null,
        tweens: {},
        knee: 40,
      });
      reset();
    });
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
