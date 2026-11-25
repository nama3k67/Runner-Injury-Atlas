import { describe, expect, it } from 'vitest';
import { findWeakenings, isCheckConfig, report } from './weakening.mjs';

// The patterns are assembled so this file does not trip the sensor it tests.
const dot = (a, b) => `${a}.${b}`;
const diffOf = (file, lines, { isNew = false } = {}) =>
  [
    `diff --git a/${file} b/${file}`,
    isNew ? '--- /dev/null' : `--- a/${file}`,
    `+++ b/${file}`,
    '@@ -1 +1 @@',
    ...lines,
  ].join('\n');

describe('weakening sensor', () => {
  it('flags added lines that switch a test or a rule off', () => {
    const diff = diffOf('apps/web/e2e/a.spec.ts', [
      `+  ${dot('test', 'skip')}('slow on CI', async () => {`,
      `+  ${dot('describe', 'only')}('picking', () => {`,
      `+  // ${'biome'}-ignore lint/style: reason`,
      `+  // @ts-${'expect-error'} narrow later`,
    ]);
    expect(findWeakenings(diff).map((f) => f.why)).toEqual([
      'adds .skip',
      'adds .only',
      'adds biome-ignore',
      'adds @ts-expect-error',
    ]);
  });

  it('ignores the same words in removed lines, prose and new checks', () => {
    const diff = [
      diffOf('apps/web/e2e/a.spec.ts', [`-  ${dot('test', 'skip')}('was skipped', () => {`]),
      diffOf('docs/lessons.md', [`+ Never use ${dot('test', 'only')} in a commit.`]),
      diffOf('tools/harness/new-check.mjs', ['+export const x = 1;'], { isNew: true }),
    ].join('\n');
    expect(findWeakenings(diff)).toEqual([]);
  });

  it('flags removed or changed lines of a check, once per file', () => {
    const diff = [
      diffOf('biome.json', ['-      "preset": "recommended",', '-      "style": {}']),
      diffOf('tools/harness/guard.mjs', ["-  if (filePath === 'pnpm-lock.yaml') {"]),
      diffOf('apps/web/src/a.tsx', ['-  return 1;']),
    ].join('\n');
    expect(findWeakenings(diff).map((f) => f.file)).toEqual([
      'biome.json',
      'tools/harness/guard.mjs',
    ]);
  });

  it('does not flag a line of a check that only grew', () => {
    const diff = diffOf('tools/harness/package.json', [
      '-    "typecheck": "node --check a.mjs"',
      '+    "typecheck": "node --check a.mjs && node --check b.mjs"',
    ]);
    expect(findWeakenings(diff)).toEqual([]);
  });

  it('knows which files define the checks', () => {
    for (const f of [
      'biome.json',
      'apps/web/vitest.config.ts',
      'apps/web/playwright.config.ts',
      'packages/sim/tsconfig.json',
      '.github/workflows/ci.yml',
      '.claude/settings.json',
      'packages/content-schema/src/validate.ts',
    ])
      expect(isCheckConfig(f), f).toBe(true);
    expect(isCheckConfig('apps/web/src/routes/index.tsx')).toBe(false);
  });

  it('explains what to do', () => {
    expect(report([])).toBe('No check was weakened.');
    expect(
      report([{ file: 'biome.json', line: 'x', why: 'removes or changes a line of a check' }]),
    ).toMatch(/`weakens-checks` label/);
  });
});
