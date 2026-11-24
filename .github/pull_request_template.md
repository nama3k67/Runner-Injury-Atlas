## What and why

<!-- One or two sentences. Link the issue: Closes #… (Refs #… if this covers only part of it).
     Housekeeping found while doing other work may go without an issue (ADR 0010). -->

## Acceptance criteria

<!-- Copy from the issue. Tick each one and say how it was verified. -->

- [ ]

## Verification

| Check                                        | Result | Evidence |
| -------------------------------------------- | ------ | -------- |
| `pnpm check`                                 |        |          |
| `pnpm e2e` (if UI, API or contracts changed) |        |          |
| `content-auditor` (if content changed)       |        |          |

## Not verified

<!-- Everything that was not proven. "Nothing" is rarely true. -->

## Authorship

- [ ] Written mostly by an AI agent, reviewed line by line by a human
- [ ] Written by a human

## Checklist

- [ ] No test, schema or guard rule was weakened to make this pass
- [ ] No personal or health data about readers is collected (ADR 0008)
- [ ] Docs updated if behaviour, commands or decisions changed
- [ ] Content: status stays "draft" unless a clinician approved this exact content hash
