import { describe, expect, it } from 'vitest';
import { blockReason, changedPaths, gateFor } from './stop-gate.mjs';

describe('stop gate', () => {
  it('reads paths from git status, including renames and untracked files', () => {
    const porcelain = [
      ' M apps/web/src/a.tsx',
      'R  old.md -> docs/new.md',
      '?? tools/harness/x.mjs',
      '',
    ].join('\n');
    expect(changedPaths(porcelain)).toEqual([
      'apps/web/src/a.tsx',
      'docs/new.md',
      'tools/harness/x.mjs',
    ]);
  });

  it('runs nothing on a clean tree, the docs lint for Markdown, the full gate otherwise', () => {
    expect(gateFor([])).toBeNull();
    expect(gateFor(['docs/lessons.md', 'CLAUDE.md'])).toBe('lint:docs');
    expect(gateFor(['docs/lessons.md', 'content/terms/itb.json'])).toBe('check');
  });

  it('hands back the end of the output and the rule', () => {
    const output = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
    const reason = blockReason('check', output);
    expect(reason).toMatch(/^pnpm check failed/);
    expect(reason).toContain('line 99');
    expect(reason).not.toContain('line 59\n');
    expect(reason).toMatch(/Fix the cause, not the check/);
  });
});
