---

description: Take one issue from acceptance criteria to a verified, review-ready change
argument-hint: <issue number or short description>
---

Work on: $ARGUMENTS

Follow docs/process.md stages 1 to 5. Do not skip a step.

1. **Specify.** Restate the acceptance criteria as a checklist. If the issue has none, write
   them and stop for confirmation before coding.
2. **Decide.** If the change touches architecture, data model, privacy or the process, check
   docs/adr/. If no ADR covers it, draft one with status "Proposed" and stop for acceptance.
3. **Plan.** List files to change, tests to add, and risks, in under 15 lines.
4. **Build.** Contracts first, then failing tests, then code. Keep controllers and components
   thin; put logic in packages.
5. **Verify.** Run `pnpm check`. Run `pnpm e2e` if UI, API routes or contracts changed. Fix
   until green without weakening any test, schema or guard rule.
6. **Report** using .github/pull_request_template.md: what changed, how each criterion was
   verified, and what was NOT verified.

If a guard hook blocks an edit, do not look for another way to make the same change. Read the
message, take the route it names, or stop and ask.
