# 13. Leaner gates for a solo maintainer

- Status: Accepted
- Date: 2026-11-24
- Amends: ADR 0009 (how stacking is described), ADR 0010 (decisions 1 and 3), ADR 0011
  (decision 3)

## Context

ADRs 0009–0011 were applied in full for the first time on 2026-11-24, by an agent working on
ADR 0012. That run showed six problems:

- **The exception for housekeeping read as a rule about commit types.** ADR 0010 lets `chore`,
  `ci`, `docs` and similar PRs skip the issue "when the change was found while doing other
  work". The agent built planned harness work as `chore` and `ci` commits without an issue, and
  without stopping for the ADR. The second condition is easy to miss, and the commit type says
  nothing about whether the work was planned.
- **A process change needs one approval per issue.** ADR 0012 has a parent issue (#38) and five
  sub-issues (#39–#43). Each one carries `draft`, so the maintainer approves the same decision
  six times: once by accepting the ADR, then once per label.
- **The rules mandate a tool whose ADR is still Proposed.** `CLAUDE.md` and `docs/process.md`
  say dependent PRs are stacked "with `gh stack`", while ADR 0009 is Proposed until a first
  trial. `gh stack` needs gh 2.90 or later and the GraphQL API. The cloud agent session had
  gh 2.89 and no GraphQL access, so only the ADR's fallback (stacking by hand) could work.
- **Moving the card to In Progress is a manual step that GitHub already does.** The board's
  "Pull request linked to issue" workflow moves the card when a PR says `Closes #N`. The agent's
  step needs GraphQL, the `project` token scope and three IDs written into `docs/process.md`,
  which nothing checks. It failed in the cloud session.
- **"The PR links its issue" is advice.** It lives in `/verify` step 4 and the PR template. A
  rule that matters belongs lower in the harness table (`docs/process.md`, design rule 1).
- **The commit-msg hook rejects `fixup!` commits**, so `git commit --fixup` with an
  autosquash rebase cannot be used to amend a lower layer of a stack. The agent had to rewrite
  the commit by hand.

## Decision

1. **Intent decides whether a change needs an issue, not the commit type.** Planned work always
   has an issue, whatever its type. A change found while doing other work, small enough to
   explain in its PR, may go without one. When unsure, it was planned. (Amends ADR 0010,
   decision 1.)
2. **One approval for work that follows an ADR.** When an issue needs an ADR, the agent opens a
   parent issue for the ADR and lists the implementation as sub-issues. Only the parent carries
   `draft`. The agent may build a sub-issue when the parent has no `draft` label, the ADR is
   Accepted on `main`, and the sub-issue itself has no `draft` label. The maintainer can still
   hold one sub-issue by adding `draft` to it. Issues that need no ADR keep their own `draft`
   label, as before. (Amends ADR 0010, decision 3.)
3. **The rules describe stacking, not a tool.** A PR that needs an unmerged branch is stacked on
   it. Use `gh stack` when `gh stack --version` works (gh 2.90 or later, GraphQL reachable).
   Otherwise stack by hand: open the PR with the lower branch as its base, and move the base to
   `main` after the lower PR merges. ADR 0009 stays Proposed until a stack built with `gh stack`
   has been tried.
4. **The agent does not move cards.** GitHub moves a card to In Progress when a PR links its
   issue. If work will span sessions before it has a PR, the agent opens a draft PR early with
   `Closes #N`. The commands and board IDs leave `docs/process.md`, and the agent's token no
   longer needs the `project` scope. (Amends ADR 0011, decision 3.)
5. **CI checks that a PR links its issue.** A `feat`, `fix` or `content` PR, judged by its
   title, fails without `Closes #N` or `Refs #N` in its body. The same job fails a PR that still
   contains `fixup!`, `squash!` or `amend!` commits. To be built under its own issue.
6. **The commit-msg hook accepts `fixup!`, `squash!` and `amend!` subjects locally.** The CI
   job in item 5 stops them from reaching `main`, so the gate as a whole is not weaker. To be
   built under the same issue as item 5.

## Consequences

- An agent can no longer skip the gate by choosing a commit type, and the maintainer approves
  ADR-backed work once.
- A sub-issue without `draft` is not approved by itself. The agent must also check its parent
  and the ADR's status, and `/feature` says so.
- The docs no longer require a tool that cannot run in every agent environment. Stacking by hand
  remains a manual base change after each merge, which is the cost ADR 0009 set out to remove.
- In Progress is correct only once a PR exists. A long task without a PR shows as Todo, unless
  the agent opens a draft PR early.
- Items 5 and 6 change harness code and land later. Until then, `/verify` step 4 remains the
  only check that a PR links its issue.
- The board IDs live only in the GitHub UI. The maintainer can still find them with
  `gh project field-list`.
