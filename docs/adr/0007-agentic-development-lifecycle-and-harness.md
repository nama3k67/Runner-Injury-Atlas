# 7. Agentic development lifecycle with an engineered harness

- Status: Accepted
- Date: 2026-11-13

## Context

AI agents write most of the code. Instructions in a prompt file are followed most of the time, which is not good enough for rules that protect health content, data or history. The maintainer also wants the way of working to be visible in the public repository.

## Decision

Adopt the lifecycle in `docs/process.md` and treat the agent's environment as engineered, versioned code:

- Context (`CLAUDE.md`, ADRs), workflows (`.claude/commands`), a specialist subagent.
- Permissions and hooks in `.claude/settings.json`; guard logic in `tools/harness`, unit-tested.
- One fast gate, `pnpm check`, identical locally and in CI; `pnpm e2e` on the real stack without Docker.
- Rules that matter are moved from advice to enforcement over time.
- Humans keep the decisions: scope, architecture, merge, publish, secrets.

Start with this minimum. Coverage thresholds, multi-agent orchestration, eval suites and release ceremony are added only when a concrete problem needs them.

## Consequences

- An agent can work autonomously on a scoped issue and prove its result.
- Harness code needs maintenance and its own tests.
- The process must not delay the product: if it does, it is cut back before features are.
