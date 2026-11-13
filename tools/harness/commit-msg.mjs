#!/usr/bin/env node
// Conventional Commits check, used by .githooks/commit-msg.
import { readFileSync } from 'node:fs';

export const TYPES = [
  'feat',
  'fix',
  'docs',
  'content',
  'refactor',
  'test',
  'chore',
  'ci',
  'build',
  'perf',
];
const PATTERN = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9-]+\\))?!?: .{3,}`);

export const isValid = (message) => {
  const subject = message.split('\n')[0] ?? '';
  return (
    subject.startsWith('Merge ') ||
    subject.startsWith('Revert ') ||
    (PATTERN.test(subject) && subject.length <= 100)
  );
};

if (process.argv[2]) {
  const message = readFileSync(process.argv[2], 'utf8');
  if (!isValid(message)) {
    console.error(
      `Commit subject must look like "type(scope): summary" (max 100 chars).\nTypes: ${TYPES.join(', ')}\nGot: ${message.split('\n')[0]}`,
    );
    process.exit(1);
  }
}
