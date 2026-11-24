---

description: Take one issue from acceptance criteria to a verified, review-ready change
argument-hint: <issue number or short description>
---

Work on: $ARGUMENTS

Follow docs/process.md stages 1 to 5. Do not skip a step.

1. **Specify.** Read the issue with `gh issue view <n>` and restate its acceptance criteria as a
   checklist. Stop before coding if:
   - the issue, or its parent, is labelled `draft`, or it has no criteria: propose criteria,
     and after the maintainer confirms, put them in the issue with the `draft` label. Wait for
     the maintainer to remove the label (ADR 0010);
   - you were given a description instead of a number: draft an issue from it the same way.
     Planned work always gets an issue, whatever its commit type. Only a small fix found while
     doing other work may go without one (ADR 0013).

   If `gh` is unavailable, work from criteria given in the prompt and say in the PR that the
   issue was not read.
2. **Decide.** If the change touches architecture, data model, privacy or the process, check
   docs/adr/. If no ADR covers it, draft one with status "Proposed", open a parent issue for it
   with the implementation as sub-issues (only the parent carries `draft`), and stop. Build a
   sub-issue only when the ADR is Accepted on `main` and neither it nor its parent has `draft`
   (ADR 0013).
3. **Plan.** List files to change, tests to add, and risks, in under 15 lines.
4. **Build.** Contracts first, then failing tests, then code. If the work will span sessions
   before it has a PR, open a draft PR early with `Closes #N`: that moves the board card to In
   Progress (ADR 0013). Keep controllers and components thin; put logic in packages.
5. **Verify.** Run `pnpm check`. Run `pnpm e2e` if UI, API routes or contracts changed. Fix
   until green without weakening any test, schema or guard rule.
6. **Report** using .github/pull_request_template.md: what changed, how each criterion was
   verified, and what was NOT verified. Link the issue with `Closes #N`, or `Refs #N` when
   the PR covers only part of it.

If a guard hook blocks an edit, do not look for another way to make the same change. Read the
message, take the route it names, or stop and ask.
