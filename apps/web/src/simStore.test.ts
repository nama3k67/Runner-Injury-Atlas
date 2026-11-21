import { describe, expect, it } from 'vitest';
import { useSimStore } from './simStore';

describe('useSimStore', () => {
  it('sets knee and hip, and reset returns to the neutral pose', () => {
    const { setKnee, setHip, reset } = useSimStore.getState();
    setKnee(25);
    setHip(4.5);
    expect(useSimStore.getState()).toMatchObject({ knee: 25, hip: 4.5 });

    reset();
    expect(useSimStore.getState()).toMatchObject({ knee: 0, hip: 0 });
  });
});
