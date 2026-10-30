# Student learning HTTP failure envelope — 2026-10-30

## Immutable references and ownership
- Legacy read-only main: `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go base main: `98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Draft PR: #219. Only `apps/web/src/features/learning/api/learning-client.ts`, its new E2E contract, and this evidence file belong to this slice.
- #161 owns review media presentation, #163 course player and progress domain, #168 foundation workspace, #200 foundation action acceptance, #164 study plan page. None of their files were edited.
- Legacy is the visual and behavioral authority; no UI components, labels, navigation, autoplay, scoring, payment, or RBAC were changed.

## Actual failure and RED evidence
The shared learning HTTP client previously accessed `body.message` without checking that JSON was a non-null object. A 503 response with valid JSON `null` therefore produced a JavaScript TypeError instead of the localized failure state. It also discarded a nested `{error:{message}}` server error and replaced it with the generic message. This affects the transport for review, study-plan writes, mastery and lesson-progress requests; it does not assert those backend endpoints always emit nested envelopes.

Tests were added before the fix in `student-learning-http-errors.spec.ts` at 390/820/1440 RTL. RED Chromium workflow: https://github.com/nasef6464/almeaago/actions/runs/40987044023 (head `3b36cabf7c2579e29034e393a3befc11ca6dcff6`). Browser results: 139 PASS, 6 FAIL, 3 SKIP. Three nested-503 cases returned the generic error instead of the server message; three null-503 cases returned `Cannot read properties of null (reading 'message')`. The three existing top-level-409 compatibility checks passed. RED was an actual browser run, not an inferred failure.

## Fix and expected GREEN
The transport now decodes non-2xx JSON defensively, prefers a non-empty nested error message, falls back to the top-level message, and uses the existing Arabic fallback for null, malformed or non-object bodies. It always rejects failed HTTP requests. No draft object or write idempotency key is modified by this transport fix.

Nine browser cases exercise read failures, a failed save followed by a retry with identical input and CSRF, and a progress-conflict regression at the three viewports. This is a **mocked API transport contract**. The 390/820/1440 executions do not constitute paired Legacy↔Go screenshots, UI parity, or a real Go/PostgreSQL persistence test.

## Delivery state
- VERIFIED after final CI: only the bounded HTTP error handling and mocked browser retry contract.
- PARTIAL: full student course/foundation/video/training/support action ordering and no-autoplay parity; #168/#200 retain ownership.
- NOT PROVEN: actual PostgreSQL commit/reload for this error slice, Legacy↔Go same-role/data screenshots, full student workflow.
- Next: #168 owner resolves #200 RED actions, then student owner validates complete course/foundation progress through HTTP→Go→PostgreSQL and back/reload with paired 390/820/1440 RTL screenshots.
- No merge, deploy, production/Legacy write, cutover, scoring, payment or RBAC change.

Four-gate CI must be read on the final SHA, with skipped and failed statuses reported honestly. This documentation path intentionally triggers the normal Backend/Frontend/Database/Browser checks, but their general success cannot be reinterpreted as a real database test of this particular client contract.
