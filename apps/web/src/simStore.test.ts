import { gaitAngle } from '@atlas/sim';
import { describe, expect, it } from 'vitest';
import { useSimStore } from './simStore';

const flat = [
  { phase: 0, deg: 21 },
  { phase: 0.5, deg: 90 },
  { phase: 1, deg: 21 },
];
const GAIT = {
  flat: { stanceEnd: 0.36, keyframes: flat, explanation: '' },
  down: { stanceEnd: 0.38, keyframes: flat, explanation: '' },
  fast: { stanceEnd: 0.28, keyframes: flat, explanation: '' },
};

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

  describe('run mode', () => {
    it('a run mode drives the knee along its curve from the start of the stride', () => {
      const { setMode, advanceGait, reset } = useSimStore.getState();
      expect(useSimStore.getState().mode).toBe('manual');
      setMode('flat');
      expect(useSimStore.getState()).toMatchObject({ mode: 'flat', phase: 0 });
      advanceGait(0.026, GAIT);
      const { phase, knee } = useSimStore.getState();
      expect(phase).toBeCloseTo(0.01);
      expect(knee).toBeCloseTo(gaitAngle(flat, phase));
      reset();
      expect(useSimStore.getState()).toMatchObject({ mode: 'manual', phase: 0 });
    });

    it('manual mode stops the stride and leaves the knee where it was', () => {
      const { setMode, advanceGait, reset } = useSimStore.getState();
      setMode('flat');
      advanceGait(0.05, GAIT);
      setMode('manual');
      const { knee, phase } = useSimStore.getState();
      advanceGait(0.05, GAIT);
      expect(useSimStore.getState()).toMatchObject({ knee, phase });
      reset();
    });

    it('opening a term with a knee angle returns to manual mode', () => {
      const { setMode, openTerm, reset } = useSimStore.getState();
      setMode('down');
      openTerm('fatpad', { kneeAngle: 25 });
      expect(useSimStore.getState()).toMatchObject({ mode: 'manual', knee: 25 });
      setMode('down');
      openTerm('gmed', { camera: 'hip' });
      expect(useSimStore.getState().mode).toBe('down');
      reset();
    });

    it('a tour step sets its mode, and tweens the knee only in manual mode (v0.3)', () => {
      const { enterTourStep, reset } = useSimStore.getState();
      enterTourStep(8, { mode: 'flat', kneeAngle: 10, hipDrop: 2 }, 0);
      expect(useSimStore.getState().mode).toBe('flat');
      expect(Object.keys(useSimStore.getState().tweens)).toEqual(['hip']);
      enterTourStep(11, { mode: 'manual', kneeAngle: 0 }, 0);
      expect(useSimStore.getState().mode).toBe('manual');
      expect(Object.keys(useSimStore.getState().tweens)).toContain('knee');
      reset();
    });
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
