/**
 * Which gate the Stop hook runs before an agent may end its turn (ADR 0012).
 * Pure so it is unit-tested (stop-gate.test.mjs); hook-stop.mjs runs it.
 */

/** Paths from `git status --porcelain` output (renames keep the new path). */
export function changedPaths(porcelain) {
  return porcelain
    .split('\n')
    .filter((line) => line.length > 3)
    .map((line) => {
      const path = line.slice(3);
      const arrow = path.indexOf(' -> ');
      return (arrow === -1 ? path : path.slice(arrow + 4)).replace(/^"|"$/g, '');
    });
}

/**
 * @param {string[]} paths  changed files, repo-relative
 * @returns {null | 'lint:docs' | 'check'}  nothing changed, only Markdown, or anything else
 */
export function gateFor(paths) {
  if (paths.length === 0) return null;
  return paths.every((p) => p.endsWith('.md')) ? 'lint:docs' : 'check';
}

/** The message sent back to the agent when the gate fails: the end of the output. */
export function blockReason(gate, output, maxLines = 40) {
  const tail = output.trimEnd().split('\n').slice(-maxLines).join('\n');
  return [
    `pnpm ${gate} failed, so the work is not done yet. The end of its output:`,
    '',
    tail,
    '',
    'Fix the cause, not the check (harness rule 5), then finish. If you cannot fix it, say so',
    'in your summary and list it under "Not verified".',
  ].join('\n');
}
