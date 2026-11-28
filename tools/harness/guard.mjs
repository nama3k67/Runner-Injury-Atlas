/**
 * Rules an AI agent may not break, enforced by a PreToolUse hook
 * (.claude/settings.json) instead of by asking nicely in CLAUDE.md.
 *
 * Pure function so the rules are unit-tested (guard.test.mjs).
 *
 * @typedef {{ tool: string, filePath: string, newText: string }} Edit
 * @param {Edit} edit  filePath is repo-relative with forward slashes.
 * @returns {string | null} reason to block, or null to allow.
 */
export function blockReason({ filePath, newText }) {
  if (filePath.startsWith('apps/web/public/legacy/')) {
    return 'legacy/ is a frozen snapshot of v0.3. Port behaviour into apps/web/src instead of editing it.';
  }
  if (
    /^apps\/api\/drizzle\/.*\.sql$/.test(filePath) ||
    filePath.startsWith('apps/api/drizzle/meta/')
  ) {
    return 'Migrations are immutable once committed. Change src/db/schema.ts and run `pnpm --filter @atlas/api db:generate`.';
  }
  if (filePath === 'pnpm-lock.yaml') {
    return 'Do not hand-edit the lockfile. Use pnpm add / pnpm install.';
  }
  if (/(^|\/)\.env(\.|$)/.test(filePath) && !filePath.endsWith('.env.example')) {
    return 'Never write secrets files. Document new variables in .env.example.';
  }
  if (/^content\/injuries\/[^/]+\/injury\.json$/.test(filePath)) {
    // Medical review gate (ADR 0006): publishing and review stamps are human-only.
    if (/"status"\s*:\s*"published"/.test(newText)) {
      return 'Only a human may set status "published". Leave status as "draft" and ask the maintainer.';
    }
    if (/"review"\s*:\s*\{/.test(newText)) {
      return 'Only a human may write a review stamp. An agent must never claim content was medically reviewed.';
    }
  }
  if (/^content\/evidence\/[^/]+\.json$/.test(filePath) && CHECKED.test(newText)) {
    // ADR 0012, item 5: an agent drafts evidence notes, only the maintainer checks them.
    return 'Only the maintainer may mark an evidence note checked, after reading the source. Leave "checked": false.';
  }
  return null;
}

const CHECKED = /"checked"\s*:\s*true/;

/**
 * A checked evidence note belongs to the maintainer: an agent edit would ride on
 * their check. The hook passes the file as it is on disk ('' when it is new).
 * @param {string} filePath  repo-relative with forward slashes
 * @param {string} currentText
 * @returns {string | null}
 */
export function blockCheckedNoteEdit(filePath, currentText) {
  if (/^content\/evidence\/[^/]+\.json$/.test(filePath) && CHECKED.test(currentText)) {
    return 'This evidence note is checked by the maintainer. Propose the change in the PR description or ask them to uncheck it first.';
  }
  return null;
}

/** Map a Claude Code tool call to the text it would write. */
export function editFromToolCall(toolName, toolInput, projectDir) {
  const abs = String(toolInput?.file_path ?? '');
  const root = projectDir.replace(/\/+$/, '');
  const filePath = (abs.startsWith(`${root}/`) ? abs.slice(root.length + 1) : abs).replaceAll(
    '\\',
    '/',
  );
  const edits = Array.isArray(toolInput?.edits) ? toolInput.edits : [];
  const newText = [toolInput?.content, toolInput?.new_string, ...edits.map((e) => e?.new_string)]
    .filter((t) => typeof t === 'string')
    .join('\n');
  return { tool: toolName, filePath, newText };
}
