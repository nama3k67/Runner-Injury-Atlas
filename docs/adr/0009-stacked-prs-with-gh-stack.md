# 9. Stacked pull requests with `gh stack`

- Status: Proposed
- Date: 2026-11-22

## Context

PRs stay small and cover one concern each (ADR 0007, `docs/process.md`). Sometimes the next
change needs code that is still in an open PR. PRs #8 and #9 were stacked by hand: #9 used the
branch of #8 as its base, and after #8 merged the base had to be moved to `main` manually. If a
lower PR changes after review, every branch above it needs a rebase, also by hand.

The GitHub CLI extension `gh-stack` (`github/gh-stack`, v0.3.0 at the time of writing, needs gh
2.90+) does this work. It sets each PR's base to the branch below. It links the PRs into a stack
that GitHub shows in the PR page. When a lower layer changes or merges, it runs a cascading rebase
and moves the upper PRs to the new base.

Options considered:

- **Stack by hand.** Works for two layers, but it is easy to forget a retarget or a rebase.
- **One larger PR.** Breaks the one-concern rule and makes review harder.
- **Wait until the lower PR merges.** Simple, but the agent sits idle while review happens.

Constraints that shape the rules below:

- The agent's terminal is not interactive. In that case `gh stack submit` creates draft PRs with
  generated titles, and `gh stack merge` merges the whole stack **without asking**.
- `gh stack sync` and `gh stack rebase` rewrite stack branches and push with
  `--force-with-lease`.
- Only the maintainer merges (`docs/process.md`, Roles).

## Decision

1. **Stack only when needed.** If a change does not need unmerged code, branch it from `main`
   and open a normal PR. Use a stack only when a change builds on a branch that has not merged yet.
2. **Use `gh stack` for every stack.** Start with `gh stack init <branch>`, or adopt existing
   branches bottom to top with `gh stack init <b1> <b2>`. Add layers with `gh stack add <branch>`.
   Create or update PRs with `gh stack submit --auto`, then give each PR its real title and
   template body with `gh pr edit`. After a lower layer changes or merges, run `gh stack sync`.
   If that stops on a conflict, use `gh stack rebase` instead.
3. **Every layer stands on its own.** One concern per layer, and `pnpm check` passes on each
   branch. The PR body names the layer below it.
4. **Merging stays with the human.** `gh stack merge`, `gh stack unstack` and `gh pr merge` are
   denied in `.claude/settings.json`. The maintainer merges, bottom up.
5. **Fallback.** If `gh stack` is missing or fails, stack by hand: create the PR with
   `gh pr create --base <lower branch>`. After the lower PR merges, move the base with
   `gh pr edit <n> --base main`.

## Consequences

- No manual base changes or rebases, and reviewers see the whole stack and its order.
- CI already runs on every `pull_request` whatever its base, so each layer gets the full gate.
- The process now depends on a young extension (v0.3). Its commands or behaviour may change.
  Section 5 is the way out.
- Force-pushes happen on stack branches. That is acceptable for the agent's own feature
  branches. `git push --force` stays denied, and `main` is never rewritten.
- PRs from `submit --auto` start as drafts with generated titles. Until the agent edits them they
  are not ready for review.
- Not verified yet: how this repository behaves with a real stack (sync after a merge commit,
  rerere, the stack map in the UI). The first stack is the trial; revisit this ADR after it.
