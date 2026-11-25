/**
 * Harness rule 5: never weaken a check to pass it. This sensor makes weakening
 * visible on a pull request (ADR 0012). It flags
 *   - added lines that switch a check off: .skip / .only / .fixme / .todo,
 *     Biome suppression comments and TypeScript `@ts-` suppressions;
 *   - removed or changed lines in the files that define the checks. A line
 *     that only grows (a new rule appended to it) is not a weakening.
 * Adding a new check is never flagged. Pure so it is unit-tested
 * (weakening.test.mjs); check-weakening.mjs runs it in CI.
 */

const SWITCH_OFF = [
  [/\b(?:it|test|describe)\.(skip|only|fixme|todo)\b/, (m) => `.${m[1]}`],
  [/(?:\/\/|\/\*)\s*biome-ignore\b/, () => 'biome-ignore'],
  [/(?:\/\/|\/\*)\s*@ts-(expect-error|ignore|nocheck)\b/, (m) => `@ts-${m[1]}`],
];

const CHECK_CONFIG = [
  /^biome\.json$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)vitest\.config\.[cm]?[jt]s$/,
  /(^|\/)playwright\.config\.[cm]?[jt]s$/,
  /^tools\/harness\//,
  /^\.githooks\//,
  /^\.github\/workflows\//,
  /^\.claude\/settings\.json$/,
  /^packages\/content-schema\/src\/(validate|schemas)\.ts$/,
];

const isCode = (file) => /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(file);
export const isCheckConfig = (file) => CHECK_CONFIG.some((re) => re.test(file));

/**
 * @param {string} diff  `git diff --unified=0` output
 * @returns {{ file: string, line: string, why: string }[]}
 */
export function findWeakenings(diff) {
  const found = [];
  let file = '';
  /** @type {Map<string, { removed: string[], added: string[] }>} */
  const configEdits = new Map();
  const edits = () => {
    const e = configEdits.get(file) ?? { removed: [], added: [] };
    configEdits.set(file, e);
    return e;
  };
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      file = '';
      continue;
    }
    if (line.startsWith('+++ ')) {
      file = line.slice(4).replace(/^b\//, '');
      continue;
    }
    if (line.startsWith('--- ')) {
      const old = line.slice(4).replace(/^a\//, '');
      if (old !== '/dev/null') file = old;
      continue;
    }
    if (line.startsWith('+') && isCode(file)) {
      for (const [re, name] of SWITCH_OFF) {
        const m = re.exec(line);
        if (m) found.push({ file, line: line.slice(1).trim(), why: `adds ${name(m)}` });
      }
    }
    if (file && isCheckConfig(file)) {
      if (line.startsWith('-')) edits().removed.push(line.slice(1).trim());
      else if (line.startsWith('+')) edits().added.push(line.slice(1).trim());
    }
  }
  for (const [f, { removed, added }] of configEdits) {
    // A removed line whose text survives inside an added line only grew.
    const core = (l) => l.replace(/[\s"',;]+$/, '');
    const lost = removed.find((r) => core(r) !== '' && !added.some((a) => a.includes(core(r))));
    if (lost !== undefined)
      found.push({ file: f, line: lost, why: 'removes or changes a line of a check' });
  }
  return found;
}

export function report(found) {
  if (found.length === 0) return 'No check was weakened.';
  return [
    'This change may weaken a check (harness rule 5 in docs/process.md):',
    ...found.map((f) => `  ${f.file}: ${f.why}: ${f.line}`),
    '',
    'If that is intended, say why in the PR body. The maintainer adds the',
    '`weakens-checks` label after reading it, and this job passes.',
  ].join('\n');
}
