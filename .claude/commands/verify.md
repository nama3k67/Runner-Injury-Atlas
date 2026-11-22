---

description: Prove the current working tree is correct, and say what is still unproven
argument-hint: "[optional: what to focus on]"
---

1. Run `pnpm check`. If it fails, show the first failure and fix the cause, not the check.
2. If the diff touches apps/web, apps/api or packages/contracts, run `pnpm e2e`.
3. If the diff touches content/, run the `content-auditor` subagent on the changed files.
4. Re-read "Known gaps" in `CLAUDE.md` and the matching item in `docs/backlog.md`. If the diff
   closes or narrows a gap listed there, update both in the same PR. If neither needs a change,
   say so in the report.
5. Report as a table: check, result, evidence (command and key output line).
6. End with "Not verified:" and list everything you could not prove, even if short.

Never report a check as passing unless you ran it in this session and saw it pass.
