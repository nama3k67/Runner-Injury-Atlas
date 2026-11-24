#!/usr/bin/env node
// Claude Code Stop hook. When the working tree has changes, run the gate that
// covers them; if it fails, block the stop and hand the failure to the agent.
// Claude Code sets stop_hook_active on the turn that follows a block, so the
// hook runs at most once per stop and a gate the agent cannot fix never loops.
import { spawnSync } from 'node:child_process';
import { blockReason, changedPaths, gateFor } from './stop-gate.mjs';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
try {
  const event = JSON.parse(raw || '{}');
  if (event.stop_hook_active) process.exit(0);
  const cwd = process.env.CLAUDE_PROJECT_DIR ?? event.cwd ?? process.cwd();
  const status = spawnSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' });
  const gate = gateFor(changedPaths(status.stdout ?? ''));
  if (gate === null) process.exit(0);
  const run = spawnSync('pnpm', [gate], { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (run.status !== 0) {
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    process.stdout.write(JSON.stringify({ decision: 'block', reason: blockReason(gate, output) }));
  }
} catch (err) {
  // A broken hook must not trap the agent; say so and let it stop.
  console.error(`hook-stop: ${err instanceof Error ? err.message : err}`);
}
