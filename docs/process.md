# Development process

How work moves from idea to production in this repository. One human maintainer, AI coding
agents doing most of the typing. The goal is a process where **the agent can go fast and
still cannot ship something wrong silently**.

Two ideas carry it:

- **SDLC**: the usual stages (plan, build, verify, review, release, operate), kept small.
- **ADLC / harness engineering**: the environment around the agent — context it reads,
  tools it may use, checks it must pass, actions it is physically blocked from — is
  engineered and versioned like code. Instructions are advice; the harness is enforcement.

## Lifecycle

| Stage      | Input                                                     | Who                         | Output                                       | Gate to leave the stage                             |
| ---------- | --------------------------------------------------------- | --------------------------- | -------------------------------------------- | --------------------------------------------------- |
| 1. Specify | Idea, feedback item, roadmap goal                         | Human (agent may draft)     | Issue with acceptance criteria               | Criteria are testable; scope fits one PR            |
| 2. Decide  | Issue that changes architecture, data, privacy or process | Human decides, agent drafts | ADR in `docs/adr/`                           | ADR accepted by the human                           |
| 3. Plan    | Issue (+ ADR)                                             | Agent                       | Short plan: files, tests, risks              | Human skims the plan for anything surprising        |
| 4. Build   | Plan                                                      | Agent                       | Tests first, then code, on a branch          | Guard hooks never tripped, or tripped and respected |
| 5. Verify  | Branch                                                    | Agent, automatically        | `pnpm check`, `pnpm e2e` when UI/API changed | All green, with nothing weakened to get there       |
| 6. Review  | PR using the template                                     | Human                       | Approved PR                                  | Human read the diff and the "not verified" list     |
| 7. Release | `main`                                                    | CI                          | Deployed build                               | CI green on `main`                                  |
| 8. Operate | Feedback inbox, errors                                    | Human + agent               | New issues                                   | —                                                   |

Content has one extra stage, between 6 and 7: the **medical review gate** below.

## The harness

What the agent works inside. Each layer exists because the previous one is not enough.

| Layer               | Where                                         | What it does                                                                                       | Enforced?           |
| ------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------- |
| Context             | `CLAUDE.md`, `docs/adr/`                      | Tells the agent the map, the commands, the rules and why                                           | No — advice         |
| Workflows           | `.claude/commands/`                           | `/feature`, `/verify`, `/add-injury`, `/adr` turn the lifecycle into repeatable prompts            | No — convenience    |
| Specialist          | `.claude/agents/content-auditor.md`           | Independent read of content claims against sources                                                 | No — second opinion |
| Permissions         | `.claude/settings.json`                       | Allow-list of routine commands; deny secrets, force-push, `rm -rf`                                 | Yes                 |
| Guard hook          | `tools/harness/guard.mjs` (PreToolUse)        | Blocks edits to frozen files and blocks an agent from publishing content or writing a review stamp | Yes, unit-tested    |
| Format hook         | `tools/harness/hook-format.mjs` (PostToolUse) | Formats every file the agent writes                                                                | Yes                 |
| Docs sensors        | `tools/harness/docs-lint.mjs`                 | Fails `pnpm check` when the docs the agent reads drift from the repo (ADR 0012)                    | Yes, unit-tested    |
| Feedback loop       | `pnpm check`                                  | One command, under a minute, same locally and in CI                                                | Yes                 |
| Types and contracts | `packages/contracts`, strict TS               | API drift fails at compile time or at the parse boundary                                           | Yes                 |
| Content rules       | `packages/content-schema`                     | Unknown sources, broken references, unreviewed "published" content fail the build                  | Yes                 |
| Real-stack tests    | PGlite + Playwright                           | Real Postgres semantics and a real browser with no Docker, so the agent can run them itself        | Yes                 |
| Git hooks           | `.githooks/`                                  | pre-commit lint, commit-msg convention, pre-push full check                                        | Yes (local)         |
| CI                  | `.github/workflows/ci.yml`                    | Same gate on every PR, plus build and e2e                                                          | Yes                 |

Design rules for the harness itself:

1. **If a rule matters, move it down the table.** A rule that only lives in `CLAUDE.md` will
   eventually be broken. The publish rule started as a sentence and is now a hook with tests.
2. **The agent must be able to verify its own work.** Anything that needs Docker, a cloud
   account or a human click is a check the agent will skip. Hence PGlite and prerendering.
3. **Fast or it is not run.** `pnpm check` stays under a minute; slower checks get their own command.
4. **Failures explain themselves.** Hook and validator messages say what to do instead.
5. **Never weaken a check to pass it.** Changing a test, a schema or a guard rule to get
   green needs its own PR and a reason.

## Medical review gate

The product makes health claims, so content has a stricter path than code.

```
draft ──► PR (agent or human) ──► pnpm check ──► clinician review ──► human stamps + publishes
            sources cited           unknown source = fail      bound to content hash
```

- Every claim cites `[^rN]`; the validator rejects citations of sources that do not exist.
- Each injury has a **content hash** (sha256 of everything a reviewer signs off).
  `pnpm validate:content` prints it.
- A clinician's decision is recorded through the API (`POST /api/reviews`, then
  `/api/reviews/:id/decision`) against that hash. The page shows "reviewed" only when
  **this exact content** was approved; editing a sentence changes the hash and the badge
  falls back to "draft".
- Marking content `published` requires a review stamp with the matching hash, and only a
  human can write it: the guard hook blocks an agent from doing so.
- AI may draft content. AI never certifies content.

## Definition of done

- Acceptance criteria met, each one covered by a test or an explicit manual check.
- `pnpm check` green; `pnpm e2e` green if UI, API or contracts changed.
- No new `any`, no skipped tests, no weakened rule.
- Docs touched if behaviour, commands or decisions changed (README, CLAUDE.md, ADR).
- PR links its issue with `Closes #N` (or `Refs #N` for part of it). Only a small fix found
  while doing other work may go without an issue (ADR 0013).
- PR description lists what was **not** verified.

## Roles

|                                            | Human (maintainer) | Agent          |
| ------------------------------------------ | ------------------ | -------------- |
| Decides scope, architecture, privacy       | Yes                | Drafts options |
| Writes code and tests                      | Sometimes          | Usually        |
| Runs verification                          | Spot-checks        | Always         |
| Approves and merges PRs                    | Yes                | Never          |
| Publishes content, records clinical review | Yes                | Blocked        |
| Handles secrets and production             | Yes                | Never          |

## Dependent changes: stacked PRs

A change that needs code from an open PR is stacked on that PR. A change that does not branches
from `main`. Use `gh stack` when `gh stack --version` works (gh 2.90 or later, GraphQL
reachable); otherwise stack by hand (ADR 0013). ADR 0009 stays Proposed until a `gh stack`
trial.

| Step                         | With `gh stack`                                                | By hand                                           |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Start or adopt a stack       | `gh stack init <branch>` / `gh stack init <b1> <b2>`           | Branch from the lower branch                      |
| Add the next layer           | `gh stack add <branch>` (from the top branch)                  | Branch from the top branch                        |
| Open or update the PRs       | `gh stack submit --auto`, then `gh pr edit` title and body     | `gh pr create --base <lower branch>`              |
| A lower layer changed/merged | `gh stack sync` (on conflict: `gh stack rebase`, `--continue`) | Rebase the layers above; `gh pr edit --base main` |
| See the stack                | `gh stack view`                                                | The "Stacked on" line in each PR body             |
| Merge                        | Maintainer only, bottom up. Denied to the agent.               | Same                                              |

Each layer is one concern, passes `pnpm check` on its own, and names the layer below it in the
PR body.

## Traceability

Issue → (ADR) → branch → commits (`type(scope): …`) → PR (template) → CI run → `main`.
Every decision that outlives a PR is an ADR. Everything known to be missing is an issue in the
milestone of its phase, and `docs/backlog.md` is the roadmap.

## Issues

Open work lives in GitHub issues (ADR 0010).

| What               | How                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Write one          | Use a template (`Feature or fix`, `Content change`); acceptance criteria are required           |
| Approve criteria   | An agent's issue starts with the `draft` label; the maintainer removes it to approve            |
| Work under an ADR  | A parent issue for the ADR carries `draft`; its sub-issues do not. One approval (ADR 0013)      |
| Needs an issue?    | Planned work always does, whatever its commit type. Not a small fix found during other work     |
| Phase              | One milestone per phase: `Phase 1`, `Phase 2`, `Phase 3`                                        |
| Area               | `area:web`, `area:api`, `area:content`, `area:sim`, `area:harness`, `area:pipeline`             |
| Waiting on someone | `needs-clinician`                                                                               |
| Too big for one PR | A parent issue with sub-issues                                                                  |
| Close              | The PR says `Closes #N`; merging closes it                                                      |
| Find work          | `gh issue list --milestone "Phase 1"`, then `gh issue view <n>`                                 |
| See progress       | The [board](https://github.com/users/nama3k67/projects/2): Todo, In Progress, Done (ADR 0011)   |
| Start work         | GitHub moves the card to In Progress when a PR links the issue; open a draft PR early if needed |
| Jot down an idea   | A draft item on the board; convert it to an issue to work on it. Agents never build from one    |
| Reader feedback    | Summarise it; never copy text that could identify the reader, nor their health details          |

GitHub moves the cards. These built-in workflows are turned on in the board's settings
(Workflows), and are listed here because they are not versioned:

- Auto-add to project: `is:issue` from `nama3k67/runner-injury-atlas` (this covers sub-issues
  too, so "Auto-add sub-issues to project" stays off)
- Item added to project → Todo
- Pull request linked to issue → In Progress (a PR saying `Closes #N` moves the card even if
  the agent did not)
- Item closed → Done
- Pull request merged → Done
- Item reopened → Todo
- Auto-close issue: moving a card to Done closes the issue, so move it there only when the work
  is finished

## What this process deliberately leaves out (for now)

Sprint ceremonies, estimates, coverage thresholds, multi-agent orchestration,
a separate eval framework, release branches. They are added when a real problem asks for them
(ADR 0007).
