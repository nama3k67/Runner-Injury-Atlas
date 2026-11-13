# 1. Record architecture decisions

- Status: Accepted
- Date: 2026-11-13

## Context

One maintainer works with AI agents across many sessions. Agents start each session without memory, and a future reader of the repository (or the maintainer in six months) needs to know why a choice was made, not only what the code does.

## Decision

Every decision that outlives a pull request is recorded as a short ADR in `docs/adr/`: context, decision, consequences. ADRs are numbered and never rewritten; a changed decision gets a new ADR that supersedes the old one. Agents read the relevant ADR before proposing to change a decision, and draft new ADRs with `/adr` for the human to accept.

## Consequences

- Decisions are cheap to find and cite from `CLAUDE.md`, PRs and code comments.
- A little writing overhead per decision.
- The ADR list doubles as the project's design history for readers of the public repository.
