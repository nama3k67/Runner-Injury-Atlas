/**
 * pnpm validate:content
 * Exit code 1 on any error. Prints each injury's content hash, which is what a
 * reviewer signs off on (see docs/process.md, "Medical review gate").
 */
import { join, resolve } from 'node:path';
import { loadContent, readNarration } from './load';
import { ContentParseError } from './parse';
import { narrationManifestSchema } from './schemas';
import { validateContent, validateNarration } from './validate';

const root = resolve(process.argv[2] ?? '../../content');
// Recorded tour narration (ADR 0014), checked against each injury's tour.json.
const narrationRoot = resolve(process.argv[3] ?? join(root, '../apps/web/public/narration'));

try {
  const content = loadContent(root);
  const { errors, warnings } = validateContent(content);
  for (const b of content.injuries) {
    const narration = readNarration(join(narrationRoot, b.injury.slug));
    if (!narration) continue;
    const file = `narration/${b.injury.slug}/manifest.json`;
    const manifest = narrationManifestSchema.safeParse(narration.manifest);
    if (!manifest.success) errors.push({ file, message: manifest.error.message });
    else errors.push(...validateNarration(b.tour, manifest.data, narration.files, file));
  }
  for (const w of warnings) console.warn(`warn  ${w.file}: ${w.message}`);
  for (const e of errors) console.error(`error ${e.file}: ${e.message}`);
  console.log(
    `\n${content.injuries.length} injuries, ${content.terms.length} terms, ${content.sources.length} sources — ${errors.length} errors, ${warnings.length} warnings`,
  );
  for (const b of content.injuries) {
    console.log(`  ${b.injury.slug}  status=${b.injury.status}  contentHash=${b.contentHash}`);
  }
  if (errors.length > 0) process.exit(1);
} catch (err) {
  if (err instanceof ContentParseError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
