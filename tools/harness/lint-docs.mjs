#!/usr/bin/env node
// pnpm lint:docs — runs the docs sensors in docs-lint.mjs over the repository.
// Part of pnpm check (ADR 0012). Exit code 1 on any issue.
import { existsSync, globSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  CLAUDE_MD_MAX_LINES,
  checkAdrIndex,
  checkLength,
  checkLessons,
  checkPaths,
  checkRule,
  RULES_MAX_LINES,
  referencedPaths,
} from './docs-lint.mjs';

const root = resolve(process.argv[2] ?? '.');
const read = (p) => readFileSync(join(root, p), 'utf8');
const skip = (p) => /(^|\/)(node_modules|\.git)(\/|$)/.test(String(p));
const matchesAny = (glob) => globSync(glob, { cwd: root, exclude: skip }).length > 0;
const exists = (p) => (p.includes('*') ? matchesAny(p) : existsSync(join(root, p)));

const topLevel = new Set(
  readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !skip(d.name))
    .map((d) => d.name),
);

/** @type {[string, string[]][]} */
const report = [];
const add = (file, issues) => issues.length > 0 && report.push([file, issues]);

add('CLAUDE.md', checkLength(read('CLAUDE.md'), CLAUDE_MD_MAX_LINES));

const rules = globSync('.claude/rules/*.md', { cwd: root });
for (const file of rules) {
  const text = read(file);
  add(file, [...checkLength(text, RULES_MAX_LINES), ...checkRule(text, matchesAny)]);
}

const living = [
  'CLAUDE.md',
  'README.md',
  'docs/process.md',
  ...globSync('.claude/**/*.md', { cwd: root, exclude: skip }),
];
for (const file of living) {
  if (existsSync(join(root, file)))
    add(file, checkPaths(referencedPaths(read(file), topLevel), exists));
}

const adrs = readdirSync(join(root, 'docs/adr'))
  .filter((n) => /^\d{4}-.+\.md$/.test(n))
  .map((name) => ({ name, text: read(`docs/adr/${name}`) }));
add('docs/adr/README.md', checkAdrIndex(read('docs/adr/README.md'), adrs));

add('docs/lessons.md', checkLessons(read('docs/lessons.md'), exists));

for (const [file, issues] of report) {
  for (const issue of issues) console.error(`error ${file}: ${issue}`);
}
const count = report.reduce((n, [, i]) => n + i.length, 0);
console.log(`docs: ${living.length + rules.length + 2} files checked, ${count} issues`);
if (count > 0) process.exit(1);
