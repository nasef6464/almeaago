# STUDENT-ATTEMPT-SAVE-01 — durable-choice boundary and serialized student actions

**Date:** 2026-10-30. **Scope:** existing learner assessment attempt page only; no changes to scoring, RBAC, assessment HTTP contracts, PostgreSQL schema or production data.

## Problem and behavior
A student can select an answer while the HTTP save is pending. A failed save must not be represented as a server-persisted answer, and submission/next-question must not race the pending write. The original attempt/review actions remain visible in their existing positions; this is a correctness slice, not a redesign.

## Implemented on PR #196
- A per-attempt/question local choice remains visible after HTTP 503, explicitly distinguished from the server-confirmed `attempt.answers` state.
- Choice, review marking and submission are serialized. Navigation/submit cannot silently discard a pending or failed answer; explicit retry uses the same question.
- Scope guards reject stale HTTP responses after account or attempt navigation. Submission retains its idempotency key after HTTP failure.
- Browser tests: `apps/web/tests/e2e/student-attempt-save-serialization.spec.ts` at 390/820/1440 RTL, save failure/retry, in-flight submit exclusion, submit retry key, and reload of server-confirmed answers.

## Acceptance limits
This is a mocked-browser functional test of UI→HTTP request behavior. **PARTIAL:** paired Legacy↔Go screenshots with identical data, real authenticated Go/PostgreSQL save/reload, server-side authorization and full scoring remain unverified by this PR. The four required CI workflows must pass on the exact final HEAD before Ready/merge. No production deployment or Legacy writes.

**Reference:** latest inspected Legacy `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`; Go integration baseline `nasef6464/almeaago/main@82f4bd53b0c2292d508d4ac4706725d3588bad10`. The branch's earlier base SHA is historical; re-check current main before merge.
