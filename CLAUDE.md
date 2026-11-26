# Runner Injury Atlas — agent guide

Interactive, source-cited dictionary of running injuries (Vietnamese content) built
around real-anatomy 3D simulations. First injury: ITBS. Solo maintainer (Nam) working
with AI agents; the process in `docs/process.md` is part of the product.

## Commands

| Command                                | What it does                                                                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                           | **The gate.** lint + docs lint + typecheck + unit/integration tests + content validation. Run before saying work is done.                                                         |
| `pnpm e2e`                             | Playwright against the real stack (API on in-process Postgres + prerendered web). Run when you touch UI, API routes or contracts. Set `CHROME_PATH` to reuse an installed Chrome. |
| `pnpm format`                          | Auto-fix lint and formatting.                                                                                                                                                     |
| `pnpm dev:web` / `pnpm dev:api:pglite` | Web on :3000, API on :3001 with in-process Postgres (no Docker).                                                                                                                  |
| `pnpm validate:content`                | Schema + cross-file rules for `content/`, prints content hashes.                                                                                                                  |
| `pnpm --filter @atlas/api db:generate` | New migration after editing `apps/api/src/db/schema.ts`.                                                                                                                          |

## Map

```
apps/web/              TanStack Start (React 19, Vite), prerendered. Routes in src/routes.
apps/api/              NestJS 12 + Drizzle + Postgres. Feedback inbox, medical review workflow.
packages/contracts/    zod schemas for every API request/response. Both apps import them.
packages/content-schema/  zod schemas, loader and cross-file rules for content/.
packages/sim/          Pure simulation maths (compression, gait curves, skin weights).
content/               The product's content as JSON. Source of truth, reviewed by humans.
tools/harness/         Agent guard hooks, commit-msg check (unit-tested).
tools/anatomy-pipeline/  BodyParts3D STL -> GLB + landmark metadata (Python, run by hand).
apps/web/public/legacy/v0.3/  Frozen single-file prototype, embedded until the R3F port lands.
docs/adr/              Why things are the way they are. Read the relevant ADR before changing a decision.
docs/lessons.md        Incidents and the rules they taught. Read before debugging a flaky or CI-only failure.
```

## Rules that are enforced (hooks/CI will stop you)

- **Never publish content or write a review stamp.** `status: "published"` and `review: {…}`
  in `content/injuries/*/injury.json` are human-only (ADR 0006). The PreToolUse hook blocks it.
- **Never edit** `apps/web/public/legacy/`, committed migrations in `apps/api/drizzle/`,
  `pnpm-lock.yaml`, or any `.env` file. Use the proper command instead.
- Every medical claim in `content/` cites a source as `[^rN]` that exists in
  `content/sources.json`. Unknown sources fail `pnpm check`.
- Commits follow Conventional Commits (`feat|fix|docs|content|refactor|test|chore|ci|build|perf`).

## Rules that rely on you

Area rules load by path: `.claude/rules/api.md` (API, contracts, NestJS DI),
`.claude/rules/content.md`, `.claude/rules/e2e-3d.md` (browser tests around the 3D scene).
These apply everywhere:

- **Content honesty.** Do not invent medical facts, numbers, or citations. If a source is
  needed and you cannot verify it, leave a `TODO(source)` in the PR description, not in content.
  Simulation numbers are qualitative illustrations; never present them as measurements.
- **Privacy (ADR 0008).** No user accounts, no contact fields, no health data about readers in
  any API contract or table. If a feature seems to need them, stop and ask.
- **Pure logic goes in packages** with tests; React components and Nest controllers stay thin.
- TypeScript is strict with `noUncheckedIndexedAccess`. No `any`, no non-null `!`; narrow instead.
- UI copy and content are Vietnamese; code, comments, docs and commit messages are English.
- Small PRs: one concern each. If a change needs a new decision, write an ADR (`/adr`).
- **Dependent PRs are stacked**: with `gh stack` when `gh stack --version` works, by hand
  otherwise (ADR 0013, steps in `docs/process.md`). Stack only when the change needs an
  unmerged branch; otherwise branch from `main`. Never merge.

## Workflow for any change

1. Read the issue (`gh issue view <n>`). Do not build on an issue without acceptance criteria,
   or while it or its parent is labelled `draft`: draft the criteria and wait for the maintainer
   to remove the label. If the work needs an ADR, it must also be Accepted on `main`
   (ADR 0010, 0013). Planned work always has an issue, whatever its commit type; only a small
   fix found while doing other work may skip it.
2. Plan in a few lines: files to touch, tests to add, risks.
3. Write the failing test, then the code.
4. `pnpm check` (and `pnpm e2e` if UI/API changed). Fix until green; do not weaken a test or a
   rule to get there.
5. Summarise in the PR template: what changed, how it was verified, what was NOT verified.
   Link the issue with `Closes #N`, or `Refs #N` when the PR covers only part of it.

Slash commands: `/feature`, `/verify`, `/add-injury`, `/adr`. Subagent: `content-auditor`.

## Known gaps (do not paper over them)

Open work is in GitHub issues, one milestone per phase: `gh issue list --milestone "Phase 1"`.
`docs/backlog.md` is the roadmap. The gaps that change how you work:

- The gait chart, run modes and the long-form ITBS sections live only in the legacy page (#16).
  Tour steps that set a run mode play without it until #18.
- Nothing has been reviewed by a clinician (#32).
- The API has only run on PGlite, never on a real Postgres server (#25).

Edit this list only when a gap appears or disappears, not on every PR.
