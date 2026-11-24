# 10. GitHub Issues as the record of open work

- Status: Accepted, amended by ADR 0011 (project board)
- Date: 2026-11-24

## Context

`docs/process.md` (ADR 0007) already assumes issues. Stage 1 outputs "an issue with acceptance
criteria". The traceability line starts with "Issue →". The PR template asks for `Closes #…`,
and `/feature` takes an issue number. In practice the repository has no issues, and none of
PRs #1–#15 links one. Open work lives as checkboxes in `docs/backlog.md`, and each work item is
passed to the agent as a chat prompt.

This has caused three problems:

- **`docs/backlog.md` is shared mutable state.** Step 4 of `/verify` makes every PR update it.
  11 of 27 non-merge commits touch it, and two merge commits had to reconcile it. PRs #13 and
  #14 were built in parallel. Both edited the same "Finish the R3F scene" line, so #14 had to
  merge `main` and re-run the full gate. With worktrees and stacked PRs (ADR 0009) this will
  keep happening.
- **The stage 1 gate leaves no record.** `/feature` drafts the criteria and stops for
  confirmation, but that confirmation stays in a chat session. Criteria first appear in the PR,
  after the code is written. Nobody can check later what was agreed before the work started.
- **The repository will become public, and the way of working should be visible (ADR 0007).**
  A reader cannot see from the repository what is planned, what is in progress, or why a PR
  exists.

Phase 2 also brings work that waits on people outside the repository: finding a clinician,
reviewer feedback, and reader feedback from the inbox (stage 8). That work needs a place to
live outside the code.

Options considered:

- **Keep `backlog.md` and fix the docs to match.** Replace "issue" with "backlog entry" in
  process.md, the PR template and `/feature`. This is the cheapest option. It fixes the mismatch
  between docs and practice, but not the merge conflicts, the missing record of approved
  criteria, or the lack of visibility.
- **One file per backlog item** (`docs/backlog/*.md`). Fewer conflicts, but this rebuilds an
  issue tracker out of files, with no closing on merge, no links from PRs and no notifications.
- **An external tracker** (Jira, Linear). Adds an account and an integration, and stays
  invisible to people who read the public repository. Rejected.
- **GitHub Issues with a Projects board, sprints and estimates.** That ceremony is built for
  teams. ADR 0007 asks for process only when a concrete problem needs it. Rejected for now.

Constraints:

- **The agent must still be able to verify its work offline** (harness rule 2). Issues must not
  become part of `pnpm check`. Context the agent needs on every task stays in the repository.
- **`gh` already needs network access and the right account.** PRs and `gh stack` depend on it,
  and the gh account guard in `tools/harness` checks the account. Issues add no new kind of
  dependency, but they make that dependency matter more.
- **Issues are not reviewed through a PR.** Editing an issue changes scope without a diff review.
- **Privacy (ADR 0008).** Once the repository is public, its issues are public too.

## Decision

1. **An issue is the unit of planned work.** Every `feat`, `fix` and `content` PR links its issue
   with `Closes #N`, or with `Refs #N` when it covers only part of the issue. `chore`, `ci`,
   `build`, `docs`, `refactor`, `test` and `perf` PRs may skip the issue when the change was found
   while doing other work.
2. **Issues use the existing templates** (`feature.yml`, `content.yml`) and must have testable
   acceptance criteria.
3. **Agent-drafted issues carry the `draft` label.** Removing the label means the maintainer has
   approved the criteria. `/feature` does not start building on an issue that still has `draft`
   (or has no criteria). That makes the stage 1 gate visible.
4. **Organisation stays minimal:**
   - One milestone per roadmap phase (Phase 1, Phase 2, Phase 3).
   - Area labels: `area:web`, `area:api`, `area:content`, `area:sim`, `area:harness` and
     `area:pipeline`.
   - Two state labels: `draft` and `needs-clinician`.
   - The issue template already records the type, so there are no type labels.
   - Work too large for one PR becomes a parent issue with native sub-issues.
5. **`docs/backlog.md` becomes the roadmap.** It keeps prose per phase (goals and gates) and
   links each phase's milestone. The checkboxes go away, and so does the "Content warnings"
   section, which becomes an issue.
6. **"Known gaps" in `CLAUDE.md` stays in the repository** as offline context for the agent, but
   kept coarse. It changes only when a gap appears or disappears, not on every PR.
7. **Workflow changes:**
   - `/feature` reads the issue with `gh issue view <n>`.
   - `/verify` step 4 checks that the PR links its issue.
   - `CLAUDE.md` says where to find open work: `gh issue list --milestone …`.
   - If `gh` is unavailable, the agent works from criteria given in the prompt and states in the
     PR that it did not read the issue.
8. **No reader data in issues.** An issue may summarise a feedback item. It must not copy text
   that could identify the reader, and it must not contain health details from the reader.
9. **Migration.** After this ADR is accepted, the agent creates one `draft` issue per unchecked
   backlog item, and the maintainer reviews them. `backlog.md`, `process.md`, `CLAUDE.md`,
   `/feature` and `/verify` change in a single PR.

Not adopted: Projects board, sprints, estimates, issue types, or automation beyond
`Closes #N`. Each is added when a concrete problem needs it (ADR 0007).

## Consequences

- No PR edits a shared status file. Merging the PR closes the issue, so parallel PRs do not
  conflict over status.
- Approved criteria exist before the code does, with a date, and can be compared with the PR.
- When the repository is public, readers and future contributors can see the plan, the work in
  progress, and the link from each change to its reason.
- Each task gets one more step: the agent drafts an issue and the maintainer approves it by
  removing `draft`. For small changes this can feel like overhead. Rule 1 exempts housekeeping
  PRs for that reason.
- Open work lives outside git. An agent starting cold runs `gh issue list` to find it. Offline
  it has only the coarse "Known gaps". `gh issue list --json` can export
  everything if the project ever leaves GitHub.
- Scope changes made by editing an issue do not go through a PR review. The maintainer accepts
  that risk as the only approver.
- Public issues are a new place where reader data could leak. Rule 8 and the PR checklist line
  for ADR 0008 cover it, but nothing enforces either yet.
- Rule 3 is advice in `/feature`, not a hook. If agents start building on `draft` issues, move
  the check down the harness table (process.md, design rule 1).
