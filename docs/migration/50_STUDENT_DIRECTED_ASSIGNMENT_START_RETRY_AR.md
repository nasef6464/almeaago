# ALMEAA V2 — Directed assignment start / retry / student scope

**Date:** 2026-10-29  
**Legacy main (read-only):** `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`  
**Go main at branch point:** `98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`  
**Owner:** student/assessment assignment presentation; does not own assessment scoring, school assignment authority, or database schema.

## Contract and verified code gap

`AssessmentAssignmentsPage.tsx` reused the sessionStorage idempotency key `assessment-assignment-start:{assignmentId}` indefinitely, including after the server confirmed an attempt. A second explicit start could therefore replay the first attempt. The key was not isolated by student identity, so switching accounts in the same browser session could reuse it. On a failed inventory read, the UI showed both the server error and a misleading empty-state message.

The new implementation scopes the pending key to student + assignment, preserves it on failed requests for safe retry, and removes it **only after** receiving the confirmed attempt. A synchronous in-flight guard prevents concurrent start clicks from the same screen. Inventory errors do not render as empty inventories. The English developer label and version badge, absent from the source student-directed assessment entry, are removed without adding UI controls.

## User journey

Student → directed assignments → server-scoped GET inventory → select assignment → CSRF → POST start with idempotency key → Go assessment service (unchanged) → persisted attempt (unchanged) → navigate to canonical attempt. Failed POST → retain pending key and draft context → retry same key. Successful POST → rotate key for the next explicit start. Switching student accounts → independent pending key. Unauthorized actors → no inventory request.

## Automated evidence

`apps/web/tests/e2e/student-directed-assignment-start-retry.spec.ts` tests 503 → retry with same key → success → re-entry with a different key at 390/820/1440 RTL; an inventory 503 without false empty state; and switching accounts after a failed start. The pre-existing `assessment-assignments.spec.ts` covers non-student access and the basic start route. These tests use intercepted HTTP responses: they **do not** prove live Go/PostgreSQL persistence or visual parity with the running Legacy application.

## Acceptance boundaries

- **VERIFIED by code inspection:** key lifecycle, student scope, and removal of two extra UI markers.
- **PENDING CI:** Backend / Frontend / Database / Browser on final PR HEAD; record actual results rather than assuming PASS.
- **PARTIAL:** full directed-assessment parity and complete student journey; source-vs-target paired screenshots with the same actor/data at 390/820/1440 are not available in this slice.
- **NOT PROVEN:** live browser → HTTP → Go → isolated PostgreSQL start/retry/reload; requires a test fixture with assignment membership, assessment publication and authorized student.
- **UNCHANGED:** scoring, payments, RBAC, schema, Legacy, production, and all other teams' files.

Do not merge or deploy without separate owner approval. The next independent slice should validate a real server-backed directed assignment with two allowed attempts, one failed transport retry, reload, and cross-student denial.
