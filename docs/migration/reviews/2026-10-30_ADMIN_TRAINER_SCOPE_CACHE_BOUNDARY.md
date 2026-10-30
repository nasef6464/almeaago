# ALMEAA V2 — Manager trainer-scope cache boundary (2026-10-30)

## Authority and ownership
- Legacy read-only `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go base `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Independent owner: `internal/content/transport/http/management.go` and new `trainer_scope_cache_test.go`. Do not edit #160's Admin/Skills UI, #230's shared JSON handler, or header.
- Existing service and PostgreSQL repository are reused; no new authorization decisions or tables.

## Concrete defect and correction
The manager's `GET /api/v1/content/trainer-scopes/{userId}` and `PUT /api/v1/content/trainer-scopes/{userId}` returned scoped path/subject assignments without a cache prohibition. An intermediary/browser may reuse stale scope data after an admin revokes a trainer's assignment. The handler now sets `Cache-Control: private, no-store` **before authentication** for both methods, including denial/CSRF/invalid-input responses. This does not alter the authoritative Go `TrainerScope` / `SetTrainerScope` service or PostgreSQL writes.

## Acceptance and evidence boundary
- HTTP→Go service: GET old scope → authenticated PUT empty arrays → GET fresh empty scope; malformed PUT must not call repository; forbidden teacher and CSRF-denied admin must not write; all responses must carry no-store. New focused tests: `go test ./internal/content/transport/http -run '^TestTrainerScopeHTTPNoStore' -count=1 -v`.
- PostgreSQL: **NOT PROVEN in this slice**. The test uses an in-memory repository double. Required follow-up is a disposable DB test using real `content_trainer_path_scopes` and `content_trainer_subject_scopes`, active identities and real auth session, checking audit/revocation and a fresh GET.
- Consumer: **NOT PROVEN**. Owner of #160 must verify original manager trainer-scope editor saves/refreshes without stale assignments and does not invent UI controls; learner/teacher consumer must be tested by its owning team.
- Visual parity: **NOT PROVEN**; no paired Legacy↔Go screenshots for admin/skills at 390/820/1440 RTL. Existing browser CI passing does not certify these screens.
- Scope status: **PARTIAL** pending exact-head CI and real PostgreSQL/browser evidence. No merge, deployment, scoring, payments, RBAC or production writes.

## Independent next acceptance
Owner #160: restore the original default manager tab and independent skills tree/buttons; close #199 draft retention and #206 missing controls with real paired screenshots. Owner of learner consumer: verify that a manager's saved change is reflected after reload in the student's allowed content. No concurrent writes to these files.
