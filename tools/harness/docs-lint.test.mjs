import { describe, expect, it } from 'vitest';
import {
  checkAdrIndex,
  checkLength,
  checkLessons,
  checkPaths,
  checkRule,
  referencedPaths,
  rulePaths,
} from './docs-lint.mjs';

const top = new Set(['apps', 'docs', 'content', '.claude']);
const has = (...paths) => {
  const set = new Set(paths);
  return (p) => set.has(p);
};

describe('length budget', () => {
  it('passes at the budget and fails one line over', () => {
    expect(checkLength('a\n'.repeat(3), 3)).toEqual([]);
    expect(checkLength('a\n'.repeat(4), 3)[0]).toMatch(/4 lines, budget is 3/);
  });
});

describe('referenced paths', () => {
  it('finds backticked repository paths and the map block', () => {
    const md = [
      'Run `pnpm check`, then read `docs/adr/` and `content/injuries/*/injury.json`.',
      '```',
      'apps/web/   the web app',
      'packages/   not a top-level dir here',
      '```',
      '```bash',
      'cat apps/ignored-in-shell-blocks.ts',
      '```',
    ].join('\n');
    expect(referencedPaths(md, top).sort()).toEqual([
      'apps/web',
      'content/injuries/*/injury.json',
      'docs/adr',
    ]);
  });

  it('skips placeholders, other slashes and secrets files', () => {
    const md =
      '`docs/adr/<n>.md` `nama3k67/runner-injury-atlas` `/api/reviews` `apps/api/.env` `apps/api/.env.example`';
    expect(referencedPaths(md, top)).toEqual(['apps/api/.env.example']);
  });

  it('reports the paths that do not exist', () => {
    expect(checkPaths(['docs/a.md', 'docs/b.md'], has('docs/a.md'))).toEqual([
      '`docs/b.md` does not exist. Fix the reference, or write the fact out if the file is gone.',
    ]);
  });
});

describe('ADR index', () => {
  const readme = [
    '| # | Decision | Status |',
    '| --- | --- | --- |',
    '| [1](0001-a.md) | A | Accepted |',
    '| [2](0002-b.md) | B | Proposed |',
  ].join('\n');
  const adr = (name, status) => ({ name, text: `# x\n\n- Status: ${status}\n` });

  it('accepts an index that matches, including an amended status', () => {
    expect(
      checkAdrIndex(readme, [
        adr('0001-a.md', 'Accepted, amended by ADR 2'),
        adr('0002-b.md', 'Proposed'),
      ]),
    ).toEqual([]);
  });

  it('catches a missing row, a dead link and a stale status', () => {
    const issues = checkAdrIndex(readme, [
      adr('0001-a.md', 'Accepted'),
      adr('0003-c.md', 'Accepted'),
    ]);
    expect(issues).toContain('row 2 links 0002-b.md, which does not exist.');
    expect(issues).toContain('0003-c.md is missing from the index. Add a row for it.');
    expect(
      checkAdrIndex(readme, [adr('0001-a.md', 'Superseded'), adr('0002-b.md', 'Proposed')])[0],
    ).toMatch(/row 1 says "Accepted", 0001-a.md says "Superseded"/);
  });

  it('catches a number that disagrees with the file name', () => {
    const bad = '| [3](0002-b.md) | B | Proposed |';
    expect(checkAdrIndex(bad, [adr('0002-b.md', 'Proposed')])[0]).toMatch(/disagree/);
  });
});

describe('lessons', () => {
  const entry = (title, meta) => `## ${title}\n\n${meta}\n\n**What happened.** …\n`;

  it('accepts itemised entries', () => {
    const md = [
      '# Lessons\n',
      entry('one', 'ID: L1 · Status: active · Scope: apps/web/e2e/'),
      entry('two', 'ID: L2 · Status: promoted · Scope: apps/web · Enforced by: apps/web/x.test.ts'),
      entry('three', 'ID: L3 · Status: retired · Scope: gone/'),
    ].join('\n');
    expect(checkLessons(md, has('apps/web/e2e/', 'apps/web/x.test.ts'))).toEqual([]);
  });

  it('requires the metadata line and unique ids', () => {
    const md = [
      entry('a', '**What happened.**'),
      entry('b', 'ID: L1 · Status: active · Scope:'),
      entry('c', 'ID: L1 · Status: active · Scope:'),
    ].join('\n');
    const issues = checkLessons(md, has());
    expect(issues[0]).toMatch(/"a": the first line must be/);
    expect(issues).toContain('"c": L1 is used twice.');
  });

  it('requires a promoted lesson to name an existing check', () => {
    expect(checkLessons(entry('a', 'ID: L1 · Status: promoted · Scope: x'), has())[0]).toMatch(
      /add "· Enforced by/,
    );
    expect(
      checkLessons(
        entry('a', 'ID: L1 · Status: promoted · Scope: x · Enforced by: t.ts'),
        has(),
      )[0],
    ).toMatch(/enforced by `t.ts`, which does not exist/);
  });

  it('flags a dead scope on an active lesson and too many active lessons', () => {
    expect(checkLessons(entry('a', 'ID: L1 · Status: active · Scope: old/'), has())[0]).toMatch(
      /scope `old\/` does not exist/,
    );
    const many = Array.from({ length: 26 }, (_, i) =>
      entry(`e${i}`, `ID: L${i} · Status: active · Scope:`),
    ).join('\n');
    expect(checkLessons(many, has()).at(-1)).toMatch(/26 active lessons, budget is 25/);
  });
});

describe('rules files', () => {
  const rule = (paths) =>
    `---\npaths:\n${paths.map((p) => `  - "${p}"`).join('\n')}\n---\n\n# Rule\n`;

  it('reads the paths frontmatter', () => {
    expect(rulePaths(rule(['apps/api/**', 'packages/contracts/**']))).toEqual([
      'apps/api/**',
      'packages/contracts/**',
    ]);
  });

  it('flags a glob that matches nothing and a rule with no paths', () => {
    const matches = (g) => g === 'apps/api/**';
    expect(checkRule(rule(['apps/api/**', 'apps/old/**']), matches)).toEqual([
      '`apps/old/**` matches no file, so this rule never loads.',
    ]);
    expect(checkRule('# Rule with no frontmatter\n', matches)[0]).toMatch(/no `paths:`/);
  });
});
