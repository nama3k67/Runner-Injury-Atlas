---

## description: Prove the current working tree is correct, and say what is still unproven

1. Run `pnpm check`. If it fails, show the first failure and fix the cause, not the check.
2. If the diff touches apps/web, apps/api or packages/contracts, run `pnpm e2e`.
3. If the diff touches content/, run the `content-auditor` subagent on the changed files.
4. Report as a table: check, result, evidence (command and key output line).
5. End with "Not verified:" and list everything you could not prove, even if short.

Never report a check as passing unless you ran it in this session and saw it pass.
