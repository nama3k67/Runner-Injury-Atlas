# 12. Layered agent context, checked by sensors

- Status: Accepted
- Date: 2026-11-24

## Context

Everything an agent knows about this repository comes from four places: `CLAUDE.md` (87 lines,
loaded on every task), `docs/process.md`, the ADRs and `docs/lessons.md`. Nothing checks that
they still match the repository. A path named in `CLAUDE.md` can be renamed away, the ADR index
in `docs/adr/README.md` is kept by hand, and a lesson has no way to say that its rule is now a
test. Every rule in `CLAUDE.md` also loads on every task: the NestJS rules load when the agent
edits content, and the content rules load when it fixes the 3D scene.

What published work says about agent context (November 2026):

- Repository context files bring a small gain or none, and raise cost by about 20%. What helps
  is instructions the agent cannot infer from the code (Gloaguen et al., arXiv 2602.11988).
- Agents follow prose rules in configuration files about 60–68% of the time. File size,
  position and splitting into several files made no measurable difference (McMillan,
  arXiv 2605.10039). This repeats ADR 0007: a rule that matters belongs in a check.
- A playbook that an LLM rewrites as a whole collapses. In one run it went from about 18,000
  tokens to 122 and the agent did worse than with no playbook. Itemised entries updated one at
  a time do not collapse (Zhang et al., arXiv 2510.04618).
- An index file is enough to find knowledge up to about a hundred documents. Search is needed
  after that (Karpathy, "LLM Wiki"). Coding agents find code with grep, not vector search.

Options considered:

- **Leave it as it is.** The repository is small and the docs are fresh. They are fresh because
  they are new; nothing will keep them that way.
- **A knowledge base with search (RAG, a vector store, an MCP server).** This repository has
  about 20 documents and exact keys everywhere: issue numbers, ADR numbers, paths, source ids.
  An index also goes stale after every commit. Rejected until there is a measured need.
- **Tiers, with a sensor on each tier.** Chosen.

## Decision

1. **Context comes in four tiers.** An agent goes down a tier only when the task needs it.
   - Tier 0, always loaded: `CLAUDE.md`, at most 150 lines. Commands, the map, the rules the
     hooks enforce, and pointers. Only what the agent cannot work out from the code.
   - Tier 1, loaded by area: `.claude/rules/*.md` with `paths:` frontmatter, which Claude Code
     loads when the agent reads a matching file, plus slash commands and their reference files.
   - Tier 2, read on demand by key: ADRs, `docs/process.md`, `docs/lessons.md`, and later the
     evidence notes for sources (item 5).
   - Tier 3, search: grep. Local full-text search is added only after logged misses (item 6).
2. **The docs are checked by machine.** `pnpm lint:docs` runs inside `pnpm check` and fails when:
   - `CLAUDE.md` is over 150 lines, or a rules file is over 80;
   - a path written in backticks in `CLAUDE.md`, `README.md`, `docs/process.md` or `.claude/`
     does not exist (ADRs and lessons are records and keep the paths they had);
   - `docs/adr/README.md` and the ADR files disagree on number, file or status;
   - a lesson has no `ID · Status · Scope` line, a `promoted` lesson does not name the check that
     replaced it, or more than 25 lessons are `active`;
   - a `paths:` glob in a rules file matches no file.
3. **An agent cannot end its turn with changed code and a red gate.** A Claude Code `Stop` hook
   runs `pnpm check` when the working tree has changes (only `pnpm lint:docs` when every change
   is Markdown) and sends the failure back to the agent. It runs at most once per stop, so a
   gate the agent cannot fix does not loop.
4. **Weakening a check is visible.** CI flags a pull request that adds `.skip`, `.only`,
   `.fixme`, a Biome suppression comment or a `@ts-` suppression, or that removes or changes a
   line of a check (`biome.json`, tsconfig, vitest and Playwright config, `tools/harness/`, git
   hooks, workflows, `.claude/settings.json`, the content validator). A line that only grows is
   not flagged, so adding a check never needs the label. The flag passes only with the
   `weakens-checks` label, which the maintainer adds after reading the reason in the PR body.
   Harness rule 5 in `docs/process.md` was advice until now.
5. **Evidence notes per source come next, in their own issue.** One note per entry in
   `content/sources.json`: study type, what the source supports, what it does not, limits, and
   whether the maintainer has checked the note. An agent may draft a note and never marks it
   checked. The validator warns about sources without a note first and fails later. This needs
   the maintainer to read the sources, so it is not part of this change.
6. **No RAG and no vector store** while the docs stay under about a hundred files with exact
   keys. Search is reconsidered when at least two of these hold: misses are logged where the
   answer was already in the repository; most questions have no key (no issue, path or id); the
   folder layout no longer matches how people look things up. Then local BM25 first, hybrid
   second, `docs/` only.

## Consequences

- A renamed file, a forgotten ADR row or a stale lesson fails `pnpm check`, where the agent
  sees it in the same task.
- Area rules leave `CLAUDE.md`, so the file stays short as the repository grows. A rule in
  `.claude/rules/` is still advice. The ones that matter keep moving down the harness table.
- The Stop hook adds up to a minute to the end of a turn that changed code.
- `weakens-checks` is one more label to apply, and only on PRs that change a check.
- Whether all this helps is measured by re-running closed issues with and without a change,
  not assumed. With a solo maintainer the numbers give a direction, not proof.
