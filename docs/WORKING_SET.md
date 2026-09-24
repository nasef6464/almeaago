# Current Working Set

## Current phase
Identity/Auth.

## Main baseline
- Foundation: GREEN.
- Identity Core: MERGED_GREEN at `86d7b14ff8ea7483ca06f55be410a079f7c45789`.

## Active branch
`feat/identity-security-recovery`

## Current slice
Identity Security + Recovery.

### In scope
- password reset.
- email verification/resend.
- one-time token lifecycle.
- phone + password login.
- strict CORS allow-list.
- auth no-store responses.
- security headers.
- PII-minimized auth payloads.
- recovery/security tests.
- migration 004.
- Database CI cost reduction.

### Explicitly not complete yet
- real email delivery/outbox.
- Google OAuth.
- WhatsApp OTP.
- Auth frontend.
- staging E2E.
- visual parity proof.

## Architecture cleanup required before Organizations
The Identity PostgreSQL repository still contains some hand-written SQL strings.
Target architecture is `pgx + sqlc`; before leaving Identity we must consolidate those queries into `db/queries` and enforce generated typed query drift in CI.

This is tracked as required work, not optional cleanup.

## CI strategy
No PR is opened until the branch batch is coherent.
Opening the PR triggers one Backend/Database verification cycle.
Database heavy job should skip later synchronize events when the latest push did not change migrations/workflow.

## Next exact action
Open the Identity Security + Recovery PR, fix all CI failures, merge only when green, then implement provider flows (Google/WhatsApp) and finish sqlc repository consolidation before moving to Auth frontend/Organizations.
