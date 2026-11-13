#!/usr/bin/env node
// Claude Code PreToolUse hook. Exit code 2 blocks the tool call and feeds
// stderr back to the agent, so it learns the rule and picks another route.
import { blockReason, editFromToolCall } from './guard.mjs';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
try {
  const event = JSON.parse(raw);
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? event.cwd ?? process.cwd();
  const reason = blockReason(editFromToolCall(event.tool_name, event.tool_input, projectDir));
  if (reason) {
    console.error(`Blocked by tools/harness/guard.mjs: ${reason}`);
    process.exit(2);
  }
} catch (err) {
  // A broken hook must not block work; say so and let the call through.
  console.error(`hook-guard: ${err instanceof Error ? err.message : err}`);
}
