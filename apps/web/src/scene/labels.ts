import type { Layer } from '../simStore';

// Kept free of three.js so the page bundle and tests can use it without the scene chunk.

export interface LabelSpec {
  text: string;
  /** Detail labels on small landmarks; shown only up close. */
  near: boolean;
  /** The layer of the labelled structure: hiding the layer hides the label. */
  layer: Layer;
}

/** Labels from legacy v0.3, short forms of the dictionary names. */
export const LABELS: Readonly<Record<string, LabelSpec>> = {
  itb: { text: 'Dải chậu chày', near: false, layer: 'itb' },
  tfl: { text: 'Cơ căng mạc đùi', near: false, layer: 'muscle' },
  gmax: { text: 'Cơ mông lớn', near: false, layer: 'muscle' },
  gmed: { text: 'Cơ mông nhỡ', near: false, layer: 'muscle' },
  vl: { text: 'Cơ rộng ngoài', near: false, layer: 'muscle' },
  lfe: { text: 'Mỏm lồi cầu ngoài', near: true, layer: 'bone' },
  fatpad: { text: 'Lớp mỡ', near: true, layer: 'fat' },
  gerdy: { text: 'Lồi củ Gerdy', near: true, layer: 'bone' },
  kaplan: { text: 'Sợi Kaplan', near: true, layer: 'itb' },
};

// Camera-to-target distances (cm) from v0.3. The ranges overlap, so mid-zoom shows both kinds.
const NEAR_MAX = 80;
const FAR_MIN = 34;

/** Whether a label shows at this camera distance; v0.3 swaps detail and overview labels with zoom. */
export const labelShown = (near: boolean, distance: number, labelsOn: boolean): boolean =>
  labelsOn && (near ? distance < NEAR_MAX : distance > FAR_MIN);
