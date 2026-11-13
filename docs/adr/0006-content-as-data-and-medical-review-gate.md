# 6. Content as data, with a medical review gate bound to a content hash

- Status: Accepted
- Date: 2026-11-13

## Context

The product makes health claims and much of the text is drafted by AI. The largest risk is wrong or outdated medical content, or content that looks professionally reviewed when it was not.

## Decision

- All content lives in `content/` as JSON validated by zod schemas. Pages can only render content that parsed.
- Every claim cites sources as `[^rN]`; citing a source missing from `content/sources.json` fails the build. Myth "facts" must cite at least one source.
- Each injury has a content hash: sha256 over its files, the terms it uses and the sources, excluding workflow fields.
- A clinician's approval is recorded against that hash (API, ADR 0005). The public badge says "reviewed" only for the exact approved content.
- `status: "published"` requires a review stamp with the matching hash.
- Only a human may publish or write a review stamp. A PreToolUse hook blocks agents from doing either.

## Consequences

- Editing one sentence after review visibly returns the page to "draft" until it is reviewed again. This is intended.
- Adding an injury is a data change plus review, not a code change.
- The automated checks prove that a citation exists, not that the source supports the claim. That judgement stays with the human reviewer; the `content-auditor` subagent only assists.
