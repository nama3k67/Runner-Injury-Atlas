---

description: Take one issue from acceptance criteria to a verified, review-ready change
argument-hint: <issue number or short description>
---

Work on: $ARGUMENTS

Follow docs/process.md stages 1 to 5. Do not skip a step.

1. **Specify.** Read the issue with `gh issue view <n>` and restate its acceptance criteria as a
   checklist. Stop before coding if:
   - the issue is labelled `draft` or has no criteria: propose criteria, and after the
     maintainer confirms, put them in the issue with the `draft` label. Wait for the maintainer
     to remove the label (ADR 0010);
   - you were given a description instead of a number: draft an issue from it the same way.
     Housekeeping (`chore`, `ci`, `docs`, …) found while doing other work may go without one.

   If `gh` is unavailable, work from criteria given in the prompt and say in the PR that the
   issue was not read.
2. **Decide.** If the change touches architecture, data model, privacy or the process, check
   docs/adr/. If no ADR covers it, draft one with status "Proposed" and stop for acceptance.
3. **Plan.** List files to change, tests to add, and risks, in under 15 lines.
4. **Build.** Move the issue's card to In Progress on the board (commands in docs/process.md,
   "Issues"); if that fails, say so in the report. Contracts first, then failing tests, then
   code. Keep controllers and components thin; put logic in packages.
5. **Verify.** Run `pnpm check`. Run `pnpm e2e` if UI, API routes or contracts changed. Fix
   until green without weakening any test, schema or guard rule.
6. **Report** using .github/pull_request_template.md: what changed, how each criterion was
   verified, and what was NOT verified. Link the issue with `Closes #N`, or `Refs #N` when
   the PR covers only part of it.

If a guard hook blocks an edit, do not look for another way to make the same change. Read the
message, take the route it names, or stop and ask.
