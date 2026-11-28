import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseContent } from './parse';
import type { Content } from './schemas';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.json')) out.push(full);
  }
  return out;
}

/** Read every JSON file under the content root (Node only). */
export function readContentFiles(root: string): Record<string, unknown> {
  const files: Record<string, unknown> = {};
  for (const full of walk(root)) {
    const key = relative(root, full).split(sep).join('/');
    files[key] = JSON.parse(readFileSync(full, 'utf8'));
  }
  return files;
}

export function loadContent(root: string): Content {
  return parseContent(readContentFiles(root));
}

/**
 * One injury's narration folder: its manifest (unparsed) and the audio files, as
 * "<voice>/<line>.ogg". Undefined when there is no manifest, so tour.json can be edited
 * before any audio exists.
 */
export function readNarration(dir: string): { manifest: unknown; files: string[] } | undefined {
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) return undefined;
  const files: string[] = [];
  for (const voice of readdirSync(dir)) {
    if (!statSync(join(dir, voice)).isDirectory()) continue;
    for (const name of readdirSync(join(dir, voice)).sort()) {
      if (name.endsWith('.ogg')) files.push(`${voice}/${name}`);
    }
  }
  return { manifest: JSON.parse(readFileSync(manifestPath, 'utf8')), files };
}
