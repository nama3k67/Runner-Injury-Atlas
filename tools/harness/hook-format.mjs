#!/usr/bin/env node
// Claude Code PostToolUse hook: format the file the agent just wrote, so
// formatting never shows up as noise in a diff or as a CI failure.
import { spawnSync } from 'node:child_process';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
try {
  const file = JSON.parse(raw).tool_input?.file_path;
  if (
    typeof file === 'string' &&
    /\.(ts|tsx|mjs|js|json|css)$/.test(file) &&
    !file.includes('/legacy/')
  ) {
    spawnSync('pnpm', ['exec', 'biome', 'check', '--write', '--no-errors-on-unmatched', file], {
      cwd: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
      stdio: 'ignore',
    });
  }
} catch {
  // Formatting is best-effort; pnpm check is the real gate.
}
