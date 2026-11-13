# 8. Store no health data or contact details about readers

- Status: Accepted
- Date: 2026-11-13

## Context

Readers arrive with an injury. Feedback forms, accounts and analytics could easily collect health information. Vietnam's Personal Data Protection Law (91/2025/QH15, in force since 1 January 2026) and its implementing decree treat health status as sensitive personal data.

## Decision

- No user accounts and no user table.
- Feedback is anonymous: the contract has no name, email or free-form contact field, and unknown fields are stripped. The form asks readers not to describe their own health.
- No request logging of message bodies beyond the stored feedback itself.
- Future personal features (rehab progress, gait analysis results) default to on-device storage; video never leaves the device.
- Any change that would store personal data needs a new ADR and legal advice first.

## Consequences

- Very little compliance surface for a personal project.
- No way to reply to feedback or to sync between devices.
- Agents are told to stop and ask when a feature seems to need personal data.
