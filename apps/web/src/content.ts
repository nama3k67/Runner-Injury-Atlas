import {
  type Content,
  type InjuryBundle,
  parseContent,
  type Source,
  type Term,
} from '@atlas/content-schema';

// Content is data in the repository (ADR 0006). It is bundled at build time
// and parsed with the same schemas CI uses, so a page cannot render content
// that failed validation.
// Evidence notes are for whoever checks claims, not for readers: keep them out of the bundle.
const modules = import.meta.glob(['../../../content/**/*.json', '!../../../content/evidence/**'], {
  eager: true,
  import: 'default',
});

const files: Record<string, unknown> = {};
for (const [path, value] of Object.entries(modules)) {
  files[path.replace(/^.*\/content\//, '')] = value;
}

export const content: Content = parseContent(files);

export const findInjury = (slug: string): InjuryBundle | undefined =>
  content.injuries.find((b) => b.injury.slug === slug);

export const termsFor = (slug: string): Term[] => content.terms.filter((t) => slug in t.injuries);

export const sourceIndex: ReadonlyMap<string, { n: number; source: Source }> = new Map(
  content.sources.map((source, i) => [source.id, { n: i + 1, source }]),
);
