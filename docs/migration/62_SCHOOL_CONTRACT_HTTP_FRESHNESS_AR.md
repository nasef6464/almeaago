# School contract HTTP freshness — school roles / entitlement checkpoint

**Source of UI/behavior (read only):** `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`  
**Implementation baseline:** `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`  
**Owner:** schools and roles; **Draft PR:** #233; no merge/deploy/cutover.

## Scope and demonstrated bug

The school contract read `GET /{schoolId}` exposes current module availability, status and optimistic revision to the authorized platform administrator. The write `PUT /{schoolId}` may revoke modules or make the contract inactive. The previous HTTP handler did not set `Cache-Control` on successful reads, updates or rejected requests. A stale stored response can therefore misrepresent the current contract revision/modules in the administrative client. This is HTTP response freshness, **not** a new RBAC policy or an assertion that the server accepted a revoked entitlement.

## RED→GREEN acceptance

A new transport test models `GET active/revision=1 → PUT inactive/revision=1 → GET inactive/revision=2 → reject stale PUT revision=1 → GET unchanged`. It also covers unauthorized GET, forbidden role, missing contract, invalid CSRF and malformed write. Every response must carry `Cache-Control: private, no-store`; denied writes must never reach the repository. This intentionally uses an in-memory repository test double and does not certify PostgreSQL persistence.

**RED evidence:** [Backend CI 40999694487](https://github.com/nasef6464/almeaago/actions/runs/40999694487), at test-only SHA `c56899c8f9a4b455e6f5345e64f1d118068fa628`. Go vet and gofmt passed; `go test ./...` failed with missing `Cache-Control` on 200, 401, 403, 404 and 400. No artificial failure or relaxed assertion.

**Fix:** Add `private, no-store` before authentication in the school contract GET and PUT handlers. It applies equally to success, auth/CSRF rejection, invalid input and revision conflict. Preserve service-side admin-only access, optimistic concurrency, SQL transactions, audit, existing status codes, and DTO shape.

## Required follow-through (not certified by this slice)

- Exact-head Backend / Frontend / Database / Browser workflows: record separate PASS/FAIL/SKIP on the final commit.
- PostgreSQL isolated integration of contract write→read, revision conflict and school separation remains **PARTIAL** until executed and linked. Existing Database CI alone is not this test.
- UI parity for school director/teacher/supervisor/parent, including paired Legacy↔Go 390/820/1440 RTL same-role/same-data screenshots, remains **NOT PROVEN**. The school contract is a platform-admin API, not a replacement for school role interfaces.
- No writes to Legacy or production. No scoring, payment, RBAC, schema or frontend file changes.

## Dependency and ownership

Do not alter `apps/web/src/features/organizations/pages/SchoolDirectorDashboardPage.tsx` (#172), parent dashboard (#162), school assessment definition (#144), school student move (#220), or cache handlers (#226). If the administrator's contract editor is restored, its owner must reload after a successful write and display 409 conflicts without silently re-enabling a revoked module. This document does not authorize changing that owner's files.
