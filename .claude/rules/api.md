---

paths:

- "apps/api/**"
- "packages/contracts/**"

---

# API and contracts

- **Contracts first.** Changing an API shape starts in `packages/contracts`, then the API,
  then the web app. Both apps import the same zod schemas, so drift fails at compile time or
  at the parse boundary.
- **NestJS DI uses explicit tokens**:
  `constructor(@Inject(FeedbackService) private readonly s: FeedbackService)`. There is no
  `emitDecoratorMetadata` (the code runs through esbuild, tsx and oxc), so implicit
  constructor injection silently yields `undefined`.
- Controllers stay thin. Logic that can be pure goes in a package with tests.
- New column or table: edit `apps/api/src/db/schema.ts`, then
  `pnpm --filter @atlas/api db:generate`. Committed migrations are never edited (the guard
  hook blocks it).
- No user accounts, contact fields or reader health data in any contract or table (ADR 0008).
- Touching routes or contracts means `pnpm e2e` too, not only `pnpm check`.
