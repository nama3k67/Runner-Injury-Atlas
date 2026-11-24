#!/usr/bin/env node
// CI: node tools/harness/check-weakening.mjs <base> [head]
// Fails when the diff weakens a check, unless ALLOW_WEAKENING=true (the PR has
// the `weakens-checks` label). See weakening.mjs.
import { spawnSync } from 'node:child_process';
import { findWeakenings, report } from './weakening.mjs';

const [base = 'origin/main', head = 'HEAD'] = process.argv.slice(2);
const diff = spawnSync('git', ['diff', '--unified=0', '--no-color', base, head], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
if (diff.status !== 0) {
  console.error(diff.stderr);
  process.exit(2);
}
const found = findWeakenings(diff.stdout);
console.log(report(found));
if (found.length > 0 && process.env.ALLOW_WEAKENING !== 'true') process.exit(1);
