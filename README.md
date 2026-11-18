# Runner Injury Atlas

> Atlas Chấn thương Runner — từ điển tương tác về chấn thương chạy bộ, bằng tiếng Việt,
> xoay quanh mô phỏng 3D giải phẫu thật. Mỗi nhận định đều có nguồn.

An interactive, source-cited dictionary of running injuries. Each injury gets one focused
page built around a real-anatomy 3D simulation that explains _why_ it hurts, not just where.
First injury: iliotibial band syndrome (ITBS).

**Status: v0.4, private draft.** No content has been reviewed by a clinician yet. This is
educational material, not medical advice.

## Why this repository might interest you

- **Agent-first engineering.** Most code is written by AI agents inside an engineered
  harness: guard hooks, contracts, content rules and real-stack tests the agent can run
  itself. See [docs/process.md](docs/process.md).
- **A hard gate for AI-drafted health content.** Claims must cite real sources, reviews are
  bound to a content hash, and an agent is technically blocked from publishing or
  certifying content. See [ADR 0006](docs/adr/0006-content-as-data-and-medical-review-gate.md).
- **Full stack in one typed monorepo.** TanStack Start + React, NestJS + Drizzle + Postgres,
  shared zod contracts, real anatomy data from BodyParts3D.

## Quick start

Requires Node 22+ and pnpm 10.

```bash
pnpm install
pnpm check            # lint, typecheck, tests, content validation
pnpm dev:api:pglite   # API on :3001 with in-process Postgres (no Docker)
pnpm dev:web          # web on :3000
pnpm e2e              # Playwright against the real stack
```

With a real Postgres instead: `docker compose up -d`, copy `apps/api/.env.example` to
`apps/api/.env`, then `pnpm --filter @atlas/api db:migrate && pnpm dev:api`.

## Architecture

```
content/ (JSON, human-reviewed) ──► packages/content-schema ──► apps/web (prerendered pages)
                                          │ content hash              │  fetch
tools/anatomy-pipeline ──► GLB + landmarks                            ▼
                                                    packages/contracts ◄──► apps/api (NestJS)
packages/sim (pure maths) ──► 3D scene                                       │ Drizzle
                                                                             ▼
                                                                         Postgres
```

| Path                      | Role                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `apps/web`                | TanStack Start, React 19, prerendered static pages                                 |
| `apps/api`                | NestJS 12, Drizzle, Postgres: anonymous content feedback, medical review workflow  |
| `packages/contracts`      | zod request/response schemas shared by both apps                                   |
| `packages/content-schema` | Content schemas, loader, cross-file rules, content hashing                         |
| `packages/sim`            | Deterministic simulation maths with tests                                          |
| `content/`                | Injuries, dictionary terms, guided-tour script, sources                            |
| `tools/harness`           | Agent guard hooks and commit checks                                                |
| `tools/anatomy-pipeline`  | BodyParts3D meshes to web-ready GLB                                                |
| `docs/`                   | [Process](docs/process.md), [ADRs](docs/adr/README.md), [backlog](docs/backlog.md) |

## What works today, and what does not

Works: content pipeline with validation, ITBS page rendered from data, feedback form,
review badge driven by the API, unit, integration and browser tests for all of it, and the
ITBS 3D rig in React Three Fiber (knee and hip-drop sliders, compression shown on the ITB and
fat pad). The full v0.3 simulation stays reachable as a frozen legacy page.

Not yet: the rest of the 3D port (layers, picking, labels, camera presets, run modes, gait
chart, guided tour), long-form ITBS sections as data,
recorded narration audio, clinician review, deployment, real authentication for reviewers.
Details in [docs/backlog.md](docs/backlog.md).

## Licences and attribution

3D anatomy: BodyParts3D, © The Database Center for Life Science, licensed under
CC BY-SA 2.1 Japan. Derived meshes in this repository are shared under the same licence.
See [NOTICE.md](NOTICE.md). A licence for the code has not been chosen yet.
