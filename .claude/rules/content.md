---

paths:

- "content/**"
- "packages/content-schema/**"

---

# Content

- Every medical claim cites `[^rN]`, and `rN` exists in `content/sources.json`. Open a source
  before citing it; a search snippet is not a source. Unknown sources fail `pnpm check`.
- Do not invent facts, numbers or citations. A claim you cannot source goes in the PR
  description as `TODO(source)`, never into content.
- Rehab phases advance by criteria (pain, function), never by dates.
- Simulation numbers are qualitative illustrations. Never present them as measurements.
- `status: "published"` and `review` are human-only (ADR 0006); the guard hook blocks them.
  Any edit changes the content hash, and the "reviewed" badge then falls back to "draft".
- Each source may have an evidence note in `content/evidence/<id>.json` (schema in
  `packages/content-schema/src/schemas.ts`): study type, what it supports, what it does not,
  limits. Read it before citing the source. Draft a note only from the source itself, always
  with `"checked": false`; checking is the maintainer's, and the guard hook blocks it. Never commit
  the paper itself (copyright); `.gitignore` keeps everything but JSON out of that folder.
- After a content change, run the `content-auditor` subagent on the changed files.
- Content is Vietnamese. Use the term ids in `content/terms/` instead of new wording for the
  same structure.
