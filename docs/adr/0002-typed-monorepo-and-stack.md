# 2. One typed pnpm monorepo: TanStack Start, NestJS, shared packages

- Status: Accepted
- Date: 2026-11-13

## Context

The product needs a web app with a heavy 3D scene, a backend, a content pipeline and shared validation rules. The maintainer's daily stack is React, TypeScript, the TanStack ecosystem and NestJS.

## Decision

A single pnpm workspace, TypeScript strict everywhere:

- `apps/web`: TanStack Start (React 19, Vite). The 3D scene will use React Three Fiber, with skeleton and skinning code kept imperative inside the frame loop.
- `apps/api`: NestJS with Drizzle and Postgres.
- `packages/*`: `contracts` (zod API schemas), `content-schema`, `sim` (pure maths).
- Workspace packages export TypeScript source directly; apps bundle them. No per-package build step.
- Biome for lint and format, Vitest for unit/integration tests, Playwright for browser tests.
- NestJS dependency injection uses explicit `@Inject(Token)` so the code runs unchanged through esbuild, tsx and Vitest without `emitDecoratorMetadata`.

## Consequences

- One install, one `pnpm check`, one place for an agent to learn.
- A contract change is a compile error in both apps in the same PR.
- Explicit `@Inject` is slightly more verbose than idiomatic NestJS and must be remembered (documented in `CLAUDE.md`).
- Versions are very recent (NestJS 12, Vite 8, TypeScript 7, zod 4); expect some ecosystem friction.
