import type { Issue } from './parse';
import type { Content } from './schemas';

export interface ValidationReport {
  errors: Issue[];
  warnings: Issue[];
}

const SOURCE_REF = /\[\^(r\d+)\]/g;

/** Every [^rN] reference found in a string. */
export function sourceRefs(text: string): string[] {
  return [...text.matchAll(SOURCE_REF)].map((m) => m[1] as string);
}

/**
 * Cross-file rules that a schema cannot express. Errors block CI; warnings are
 * printed for the human reviewer.
 *
 * These rules are the automated half of the medical-content gate (ADR 0006):
 * a claim cannot cite a source that does not exist, and nothing can be marked
 * published without a review stamp for exactly the current content.
 */
export function validateContent(content: Content): ValidationReport {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const sourceIds = new Set(content.sources.map((s) => s.id));
  const termIds = new Set(content.terms.map((t) => t.id));
  const slugs = new Set(content.injuries.map((b) => b.injury.slug));
  const usedSources = new Set<string>();

  const checkRefs = (file: string, where: string, text: string) => {
    for (const ref of sourceRefs(text)) {
      usedSources.add(ref);
      if (!sourceIds.has(ref))
        errors.push({ file, message: `${where}: cites unknown source [^${ref}]` });
    }
  };
  const checkSourceId = (file: string, where: string, ref: string) => {
    usedSources.add(ref);
    if (!sourceIds.has(ref)) errors.push({ file, message: `${where}: unknown source "${ref}"` });
  };
  const checkTerm = (file: string, where: string, termId: string) => {
    if (!termIds.has(termId)) errors.push({ file, message: `${where}: unknown term "${termId}"` });
  };

  const seenSource = new Set<string>();
  for (const s of content.sources) {
    if (seenSource.has(s.id))
      errors.push({ file: 'sources.json', message: `duplicate id ${s.id}` });
    seenSource.add(s.id);
  }

  for (const term of content.terms) {
    const file = `terms/${term.id}.json`;
    checkRefs(file, 'short', term.short);
    checkRefs(file, 'body', term.body);
    for (const rel of term.related) {
      checkTerm(file, 'related', rel);
      if (rel === term.id) errors.push({ file, message: 'related: term references itself' });
    }
    for (const [slug, link] of Object.entries(term.injuries)) {
      if (!slugs.has(slug)) errors.push({ file, message: `injuries: unknown injury "${slug}"` });
      checkRefs(file, `injuries.${slug}.role`, link.role);
      if (link.scene?.structure)
        checkTerm(file, `injuries.${slug}.scene.structure`, link.scene.structure);
    }
    const cited =
      sourceRefs(term.body).length +
      sourceRefs(term.short).length +
      Object.values(term.injuries).reduce((n, l) => n + sourceRefs(l.role).length, 0);
    if (cited === 0 && term.category !== 'bone')
      warnings.push({ file, message: 'makes claims without citing any source' });
  }

  for (const bundle of content.injuries) {
    const { injury, rehab, myths, tour, simulation } = bundle;
    const dir = `injuries/${injury.slug}`;

    for (const ref of injury.summarySources)
      checkSourceId(`${dir}/injury.json`, 'summarySources', ref);
    for (const t of injury.featuredTerms) checkTerm(`${dir}/injury.json`, 'featuredTerms', t);
    for (const t of injury.featuredTerms) {
      const term = content.terms.find((x) => x.id === t);
      if (term && !(injury.slug in term.injuries))
        errors.push({
          file: `${dir}/injury.json`,
          message: `featuredTerms: term "${t}" has no role for this injury`,
        });
    }
    if (injury.status === 'published') {
      if (!injury.review) {
        errors.push({
          file: `${dir}/injury.json`,
          message: 'status "published" requires a review stamp (medical review gate)',
        });
      } else if (injury.review.contentHash !== bundle.contentHash) {
        errors.push({
          file: `${dir}/injury.json`,
          message: `content changed after review: stamp covers ${injury.review.contentHash.slice(0, 12)}…, current content is ${bundle.contentHash.slice(0, 12)}…`,
        });
      }
    }

    checkSourceId(`${dir}/rehab.json`, 'painRule.source', rehab.painRule.source);
    for (const phase of rehab.phases) {
      for (const text of [phase.goal, phase.gate, ...phase.do, ...phase.avoid])
        checkRefs(`${dir}/rehab.json`, phase.id, text);
    }
    for (const myth of myths) {
      checkRefs(`${dir}/myths.json`, myth.id, myth.fact);
      if (sourceRefs(myth.fact).length === 0)
        errors.push({
          file: `${dir}/myths.json`,
          message: `${myth.id}: a "fact" must cite a source`,
        });
    }

    const lineIds = new Set<string>();
    for (const step of tour.steps) {
      if (step.enter.highlight)
        checkTerm(`${dir}/tour.json`, `${step.id}.enter.highlight`, step.enter.highlight);
      for (const line of step.lines) {
        if (lineIds.has(line.id))
          errors.push({ file: `${dir}/tour.json`, message: `duplicate line id ${line.id}` });
        lineIds.add(line.id);
        for (const action of line.actions ?? []) {
          if (action.type === 'highlight') checkTerm(`${dir}/tour.json`, line.id, action.structure);
        }
      }
    }

    for (const ref of simulation.sources) checkSourceId(`${dir}/simulation.json`, 'sources', ref);
    const zone = simulation.impingementZone;
    if (zone.minDeg >= zone.maxDeg)
      errors.push({
        file: `${dir}/simulation.json`,
        message: 'impingementZone: min must be < max',
      });
    if (simulation.compression.baseline + simulation.compression.hipDropGain > 1 + 1e-9)
      errors.push({
        file: `${dir}/simulation.json`,
        message: 'compression: baseline + hipDropGain must be <= 1',
      });
    for (const [mode, curve] of Object.entries(simulation.gait)) {
      const kf = curve.keyframes;
      const first = kf[0];
      const last = kf[kf.length - 1];
      if (first?.phase !== 0 || last?.phase !== 1)
        errors.push({
          file: `${dir}/simulation.json`,
          message: `gait.${mode}: keyframes must start at phase 0 and end at phase 1`,
        });
      else if (first.deg !== last.deg)
        errors.push({
          file: `${dir}/simulation.json`,
          message: `gait.${mode}: stride must loop (first deg = last deg)`,
        });
      for (let i = 1; i < kf.length; i++) {
        if ((kf[i]?.phase ?? 0) <= (kf[i - 1]?.phase ?? 0))
          errors.push({
            file: `${dir}/simulation.json`,
            message: `gait.${mode}: phases must increase`,
          });
      }
    }
  }

  for (const s of content.sources) {
    if (!usedSources.has(s.id))
      warnings.push({ file: 'sources.json', message: `${s.id} is never cited` });
  }
  return { errors, warnings };
}
