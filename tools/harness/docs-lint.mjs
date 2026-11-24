/**
 * Sensors on the agent's context (ADR 0012): the docs an agent reads must still
 * match the repository. Pure functions over text, so every rule is unit-tested
 * (docs-lint.test.mjs). lint-docs.mjs reads the files and runs them.
 *
 * Each check returns a list of messages. A message says what is wrong and what
 * to do instead.
 */

export const CLAUDE_MD_MAX_LINES = 150;
export const RULES_MAX_LINES = 80;
export const MAX_ACTIVE_LESSONS = 25;

const lineCount = (text) => text.replace(/\n$/, '').split('\n').length;

/** At most `max` lines. */
export function checkLength(text, max) {
  const n = lineCount(text);
  return n > max
    ? [
        `${n} lines, budget is ${max}. Move area rules to .claude/rules/ and detail to docs/, and leave a pointer.`,
      ]
    : [];
}

/** Remove fenced code blocks, keeping a list of the plain ones (no language tag). */
function splitFences(markdown) {
  const plain = [];
  const prose = markdown.replace(/^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm, (_, lang, body) => {
    if (lang.trim() === '' || lang.trim() === 'text') plain.push(body);
    return '';
  });
  return { prose, plain };
}

/**
 * Repository paths a document refers to: backticked tokens with a slash whose
 * first segment is a top-level directory, and the first word of each line of a
 * plain code block (the map in CLAUDE.md). Placeholders and secrets files are
 * skipped: rules name `.env` files precisely because they must not exist.
 *
 * @param {string} markdown
 * @param {Set<string>} topLevel  top-level directory names of the repository
 */
export function referencedPaths(markdown, topLevel) {
  const { prose, plain } = splitFences(markdown);
  const tokens = [...prose.matchAll(/`([^`\s]+)`/g)].map((m) => m[1] ?? '');
  for (const block of plain) {
    for (const line of block.split('\n')) tokens.push(line.trim().split(/\s+/)[0] ?? '');
  }
  const out = new Set();
  for (const raw of tokens) {
    const token = raw.replace(/[.,:;]+$/, '');
    if (!token.includes('/') || /[<>{}$]/.test(token)) continue;
    if (!topLevel.has(token.split('/')[0] ?? '')) continue;
    if (/(^|\/)\.env(\.|$)/.test(token) && !token.endsWith('.env.example')) continue;
    out.add(token.length > 1 ? token.replace(/\/$/, '') : token);
  }
  return [...out];
}

/**
 * @param {string[]} paths
 * @param {(path: string) => boolean} exists  a literal path, or a glob with `*`
 */
export function checkPaths(paths, exists) {
  return paths
    .filter((p) => !exists(p))
    .map(
      (p) =>
        `\`${p}\` does not exist. Fix the reference, or write the fact out if the file is gone.`,
    );
}

/**
 * The ADR index and the ADR files must agree.
 *
 * @param {string} readme  docs/adr/README.md
 * @param {{ name: string, text: string }[]} files  the NNNN-*.md files
 */
export function checkAdrIndex(readme, files) {
  const issues = [];
  const rows = [...readme.matchAll(/^\|\s*\[(\d+)\]\(([^)]+)\)\s*\|[^|]*\|\s*([^|]+?)\s*\|\s*$/gm)];
  const byName = new Map(files.map((f) => [f.name, f.text]));
  const listed = new Set();
  for (const [, num, link, status] of rows) {
    if (!link || !num || !status) continue;
    if (listed.has(link)) issues.push(`${link} is listed twice.`);
    listed.add(link);
    const text = byName.get(link);
    if (text === undefined) {
      issues.push(`row ${num} links ${link}, which does not exist.`);
      continue;
    }
    if (Number(link.slice(0, 4)) !== Number(num))
      issues.push(`row ${num} links ${link}; the number and the file name disagree.`);
    const fileStatus = /^- Status: (.+)$/m.exec(text)?.[1]?.trim() ?? '';
    if (!fileStatus.startsWith(status))
      issues.push(
        `row ${num} says "${status}", ${link} says "${fileStatus}". Update the index to match the ADR.`,
      );
  }
  for (const { name } of files) {
    if (!listed.has(name)) issues.push(`${name} is missing from the index. Add a row for it.`);
  }
  return issues;
}

/**
 * Lessons are itemised so that they can be filtered, counted and retired, and
 * never need rewriting as a whole (ADR 0012). Each `## ` entry starts with
 *
 *   ID: L2 · Status: active · Scope: apps/web/e2e/
 *
 * Status is active, promoted (the rule is now a check: add `· Enforced by: <path>`)
 * or retired. Scope lists the paths the rule is about, comma-separated.
 *
 * @param {string} markdown  docs/lessons.md
 * @param {(path: string) => boolean} exists
 */
export function checkLessons(markdown, exists) {
  const issues = [];
  const ids = new Set();
  let active = 0;
  const entries = markdown.split(/^## /m).slice(1);
  for (const entry of entries) {
    const title = entry.split('\n')[0]?.trim() ?? '';
    const meta = entry
      .split('\n')
      .slice(1)
      .find((l) => l.trim() !== '');
    const fields = new Map(
      (meta ?? '').split(' · ').map((part) => {
        const i = part.indexOf(':');
        return [part.slice(0, i).trim(), part.slice(i + 1).trim()];
      }),
    );
    const id = fields.get('ID') ?? '';
    const status = fields.get('Status') ?? '';
    if (!/^L\d+$/.test(id) || !['active', 'promoted', 'retired'].includes(status)) {
      issues.push(
        `"${title}": the first line must be "ID: L<n> · Status: active|promoted|retired · Scope: <paths>".`,
      );
      continue;
    }
    if (ids.has(id)) issues.push(`"${title}": ${id} is used twice.`);
    ids.add(id);
    if (status === 'active') {
      active++;
      for (const p of (fields.get('Scope') ?? '').split(',').map((s) => s.trim())) {
        if (p && !exists(p)) issues.push(`${id}: scope \`${p}\` does not exist.`);
      }
    }
    if (status === 'promoted') {
      const by = fields.get('Enforced by') ?? '';
      if (!by) issues.push(`${id} is promoted: add "· Enforced by: <path of the test or lint>".`);
      else if (!exists(by)) issues.push(`${id}: enforced by \`${by}\`, which does not exist.`);
    }
  }
  if (active > MAX_ACTIVE_LESSONS)
    issues.push(
      `${active} active lessons, budget is ${MAX_ACTIVE_LESSONS}. Promote a rule to a check or retire one.`,
    );
  return issues;
}

/** The `paths:` globs in a rules file's frontmatter. */
export function rulePaths(markdown) {
  const front = /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1] ?? '';
  const block = /^paths:\s*\n((?:\s+-.*\n?)*)/m.exec(front)?.[1] ?? '';
  return [...block.matchAll(/^\s+-\s*["']?([^"'\n]+?)["']?\s*$/gm)].map((m) => m[1] ?? '');
}

/**
 * A rules file loads only when the agent touches a matching file, so a glob
 * that matches nothing means the rule never loads.
 *
 * @param {string} markdown
 * @param {(glob: string) => boolean} matchesAny
 */
export function checkRule(markdown, matchesAny) {
  const globs = rulePaths(markdown);
  if (globs.length === 0)
    return ['no `paths:` frontmatter. A rule for every task belongs in CLAUDE.md.'];
  return globs
    .filter((g) => !matchesAny(g))
    .map((g) => `\`${g}\` matches no file, so this rule never loads.`);
}
