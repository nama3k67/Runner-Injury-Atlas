# 11. A Kanban board over the issues

- Status: Proposed
- Date: 2026-11-24
- Amends: ADR 0010 (its "Not adopted: Projects board")

## Context

ADR 0010 made GitHub issues the record of open work and left out a project board, under ADR
0007's rule to add process only when a concrete problem needs it. The problem was there from the
start: the maintainer adopted issues to follow work at a glance, the way a Kanban board shows it.

Issues alone cannot show that. An issue is either open or closed. Milestones show how much of a
phase is done, but not what is being worked on right now. With agents working in parallel
(worktrees, stacked PRs, ADR 0009), "what is in progress" is the question the maintainer asks
most.

Options considered:

- **Milestones and filters only** (ADR 0010 as is). Nothing to maintain, but nothing shows work
  in progress.
- **An `in-progress` label.** Works with `gh issue` alone, but labels give no board view, and
  nothing removes the label when the work ends.
- **A GitHub Project with a status column.** GitHub keeps most columns up to date by itself,
  and the board is a view over the same issues, so nothing is copied.
- **A status column for approval as well** ("Draft", "Ready"). Rejected. The agent would have to
  read project fields to know whether it may start, which needs more permissions and more steps
  than reading a label. The `draft` label stays the gate.

## Decision

1. **One GitHub Project**, "Runner Injury Atlas", owned by the maintainer's account and linked
   to the repository. Board layout, with a single-select Status field: Todo, In Progress, Done.
2. **GitHub moves the cards wherever it can.** The maintainer turns on these built-in workflows
   in the project settings:
   - auto-add issues from this repository;
   - item added → Todo;
   - item closed → Done;
   - pull request merged → Done;
   - item reopened → Todo.
3. **The agent moves a card to In Progress** when it starts building on an approved issue
   (`/feature`, Build step), with the commands in `docs/process.md`. If it cannot, for example
   because `gh` lacks the `project` scope, it says so in its report.
4. **Approval stays on the label.** Cards show the `draft` label, and a second board view
   filtered on `label:draft` lists what is waiting for the maintainer.
5. **Cards are issues, or draft items for ideas.** Pull requests are not added; an issue's card
   shows its linked PR. A draft item (GitHub calls it a "draft issue"; it has nothing to do
   with the `draft` label) records an idea that is not specified yet. It has no number, labels,
   milestone or criteria, and no PR can close it.
   - The maintainer creates draft items. An agent creates one only when asked.
   - To work on an idea, convert the draft item to an issue and write criteria, using the
     templates. The new issue starts with the `draft` label, as in ADR 0010.
   - Agents never build from a draft item.

## Consequences

- The maintainer can see Todo, In Progress and Done at a glance without running a command.
- GitHub keeps Todo and Done correct. In Progress depends on the agent. If agents forget, cards
  stay in Todo while their PRs are open. The PR link on the card still shows the truth.
- The agent's `gh` token needs the `project` scope, so the agent can edit any project of that
  account, not only this one.
- The workflows are configured in the GitHub UI and are not versioned. `docs/process.md` lists
  them so the board can be rebuilt.
- Ideas can be written down in seconds without an issue template, and the issue list keeps only
  work that is specified. Draft items live only on the board: they are not in git, and readers
  of the repository see them only if the project is public. `docs/backlog.md` stays the in-repo
  description of each phase.
- A user-owned project has its own visibility. It must be made public when the repository is.
