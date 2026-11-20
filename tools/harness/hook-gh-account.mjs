#!/usr/bin/env node
// Claude Code PreToolUse hook (matcher: Bash). Exit code 2 blocks the call and
// feeds stderr back to the agent. Never switches accounts itself.
import { execFileSync } from 'node:child_process';
import { ghAccountReason, touchesGitHub } from './gh-account.mjs';

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
try {
  const event = JSON.parse(raw);
  const command = String(event.tool_input?.command ?? '');
  if (touchesGitHub(command)) {
    const cwd = process.env.CLAUDE_PROJECT_DIR ?? event.cwd ?? process.cwd();
    const reason = ghAccountReason({
      command,
      remoteUrl: run('git', ['remote', 'get-url', 'origin'], cwd),
      status: run('gh', ['auth', 'status'], cwd),
    });
    if (reason) {
      console.error(`Blocked by tools/harness/gh-account.mjs: ${reason}`);
      process.exit(2);
    }
  }
} catch (err) {
  // A broken hook must not block work; say so and let the call through.
  console.error(`hook-gh-account: ${err instanceof Error ? err.message : err}`);
}
