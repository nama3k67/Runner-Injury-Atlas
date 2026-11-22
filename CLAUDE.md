# Runner Injury Atlas — agent guide

Interactive, source-cited dictionary of running injuries (Vietnamese content) built
around real-anatomy 3D simulations. First injury: ITBS. Solo maintainer (Nam) working
with AI agents; the process in `docs/process.md` is part of the product.

## Commands

| Command                                | What it does                                                                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                           | **The gate.** lint + typecheck + unit/integration tests + content validation. Run before saying work is done.                                                                     |
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

- **Content honesty.** Do not invent medical facts, numbers, or citations. If a source is
  needed and you cannot verify it, leave a `TODO(source)` in the PR description, not in content.
  Simulation numbers are qualitative illustrations; never present them as measurements.
- **Privacy (ADR 0008).** No user accounts, no contact fields, no health data about readers in
  any API contract or table. If a feature seems to need them, stop and ask.
- **Contracts first.** Changing an API shape starts in `packages/contracts`, then API, then web.
- **Pure logic goes in packages** with tests; React components and Nest controllers stay thin.
- **NestJS DI uses explicit tokens**: `constructor(@Inject(FeedbackService) private readonly s: FeedbackService)`.
  There is no `emitDecoratorMetadata` (the code runs through esbuild/tsx/oxc), so implicit
  constructor injection silently yields `undefined`.
- TypeScript is strict with `noUncheckedIndexedAccess`. No `any`, no non-null `!`; narrow instead.
- UI copy and content are Vietnamese; code, comments, docs and commit messages are English.
- Small PRs: one concern each. If a change needs a new decision, write an ADR (`/adr`).

## Workflow for any change

1. Read the issue's acceptance criteria. If there are none, write them first and confirm.
2. Plan in a few lines: files to touch, tests to add, risks.
3. Write the failing test, then the code.
4. `pnpm check` (and `pnpm e2e` if UI/API changed). Fix until green; do not weaken a test or a
   rule to get there.
5. Summarise in the PR template: what changed, how it was verified, what was NOT verified.

Slash commands: `/feature`, `/verify`, `/add-injury`, `/adr`. Subagent: `content-auditor`.

## Known gaps (do not paper over them)

See `docs/backlog.md`. Notably: the R3F scene has the rig, sliders and layer toggles only
(Kaplan fibres, picking, labels, tour still live in the legacy page); long-form prose
sections of ITBS live only in the legacy page; nothing has been reviewed by a clinician;
the API has not been run against a real Postgres server yet (only PGlite).
