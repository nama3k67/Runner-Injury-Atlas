import { describe, expect, it } from 'vitest';
import meta from '../../public/anatomy/leg-right.meta.json';
import { content } from '../content';
import { isClick, PART_TERM, type Pickable, SCENE_TERMS, termAt } from './picking';

const node = (
  userData: Record<string, unknown> = {},
  parent: Pickable | null = null,
  visible = true,
): Pickable => ({ userData, parent, visible });

describe('PART_TERM', () => {
  it('maps every anatomy part to a term that exists in content', () => {
    const termIds = new Set(content.terms.map((t) => t.id));
    for (const part of Object.keys(meta.parts)) {
      const term = PART_TERM[part];
      expect(term, part).toBeDefined();
      expect(termIds.has(term ?? ''), `${part} -> ${term}`).toBe(true);
    }
    for (const term of SCENE_TERMS) expect(termIds.has(term), term).toBe(true);
  });

  it('groups parts the way v0.3 did', () => {
    expect(PART_TERM.bfl).toBe('bf');
    expect(PART_TERM.bfs).toBe('bf');
    expect(PART_TERM.sacrum).toBe('pelvis');
    expect(PART_TERM.mt3).toBe('foot');
  });
});

describe('isClick', () => {
  it('treats up to 6 px of movement as a click and more as an orbit drag', () => {
    expect(isClick({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(true);
    expect(isClick({ x: 10, y: 10 }, { x: 14, y: 14 })).toBe(true);
    expect(isClick({ x: 10, y: 10 }, { x: 16, y: 10 })).toBe(true);
    expect(isClick({ x: 10, y: 10 }, { x: 17, y: 10 })).toBe(false);
  });
});

describe('termAt', () => {
  it('returns the term of the nearest hit, reading it from an ancestor when needed', () => {
    const kaplan = node({ term: 'kaplan' });
    const strand = node({}, kaplan);
    expect(termAt([{ object: strand }, { object: node({ term: 'femur' }) }])).toBe('kaplan');
  });

  it('skips hits inside a hidden layer', () => {
    const hiddenLayer = node({}, null, false);
    const muscle = node({ term: 'vl' }, hiddenLayer);
    expect(termAt([{ object: muscle }, { object: node({ term: 'femur' }) }])).toBe('femur');
    expect(termAt([{ object: node({ term: 'vl' }, null, false) }])).toBeNull();
  });

  it('looks through visible objects that have no term', () => {
    const arrow = node();
    expect(termAt([{ object: arrow }, { object: node({ term: 'fatpad' }) }])).toBe('fatpad');
    expect(termAt([])).toBeNull();
  });
});
