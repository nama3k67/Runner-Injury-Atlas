// Kept free of three.js so the mapping can be tested and imported without the scene chunk.

/** Anatomy GLB part -> dictionary term, as in legacy v0.3 (PART_ENTRY). */
export const PART_TERM: Readonly<Record<string, string>> = {
  pelvisR: 'pelvis',
  pelvisL: 'pelvis',
  sacrum: 'pelvis',
  femur: 'femur',
  patella: 'patella',
  tibia: 'tibia',
  fibula: 'fibula',
  talus: 'foot',
  calcaneus: 'foot',
  navicular: 'foot',
  cuboid: 'foot',
  cun1: 'foot',
  cun2: 'foot',
  cun3: 'foot',
  mt1: 'foot',
  mt2: 'foot',
  mt3: 'foot',
  mt4: 'foot',
  mt5: 'foot',
  gmax: 'gmax',
  gmed: 'gmed',
  tfl: 'tfl',
  vl: 'vl',
  rf: 'rf',
  bfl: 'bf',
  bfs: 'bf',
  itb: 'itb',
};

/** Terms of the objects the rig adds on top of the GLB. */
export const SCENE_TERMS = ['fatpad', 'kaplan', 'lfe', 'gerdy'] as const;

const CLICK_TOLERANCE_PX = 6;

interface Point {
  x: number;
  y: number;
}

/** A pointer that moved further than this between down and up was orbiting, not picking. */
export const isClick = (down: Point, up: Point): boolean =>
  Math.hypot(up.x - down.x, up.y - down.y) <= CLICK_TOLERANCE_PX;

/** The slice of THREE.Object3D that picking reads. */
export interface Pickable {
  visible: boolean;
  parent: Pickable | null;
  userData: Record<string, unknown>;
}

/** Term of the nearest hit that is actually on screen (raycasting ignores `visible`). */
export function termAt(hits: readonly { object: Pickable }[]): string | null {
  for (const { object } of hits) {
    let term: string | null = null;
    let shown = true;
    for (let o: Pickable | null = object; o; o = o.parent) {
      if (!o.visible) {
        shown = false;
        break;
      }
      const t = o.userData.term;
      if (term === null && typeof t === 'string') term = t;
    }
    if (shown && term !== null) return term;
  }
  return null;
}
