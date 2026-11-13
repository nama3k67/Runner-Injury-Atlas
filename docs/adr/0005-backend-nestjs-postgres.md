# 5. A NestJS + Postgres backend from the start, scoped to feedback and review workflow

- Status: Accepted (supersedes the plan note "no backend until phase 4")
- Date: 2026-11-13

## Context

The first plan deferred any backend until user accounts were needed, to save operating effort. The maintainer then decided (2026-11-13) that a backend is an important part of what this repository demonstrates, and chose NestJS + Postgres.

A backend with nothing real to do would be decoration. Two real needs exist today: readers should be able to report wrong or unclear content, and the medical review gate (ADR 0006) needs a record of who approved which exact content.

## Decision

`apps/api` provides:

- `POST /api/feedback` (public, anonymous, rate limited), `GET /api/feedback`, `PATCH /api/feedback/:id/resolve` (admin).
- `POST /api/reviews`, `POST /api/reviews/:id/decision`, `GET /api/reviews` (admin) and `GET /api/reviews/badge` (public): review rounds bound to a content hash.
- `GET /api/health`.

Drizzle ORM with generated SQL migrations. `DATABASE_URL` selects the driver: `postgres://` for node-postgres, `pglite://` for in-process Postgres used by tests, e2e and Docker-free local runs. Admin endpoints use a shared `x-admin-key` for now.

## Consequences

- The backend carries real behaviour that the web app and the content gate depend on.
- Operating cost: an API host and a managed Postgres once deployed.
- The shared admin key is not acceptable for a public launch; reviewer authentication is a phase 2 item.
- Only PGlite has been exercised so far; a real Postgres run is on the backlog.
- User accounts, progress tracking and gait-analysis history remain out of scope (ADR 0008).
