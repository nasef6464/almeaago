# Current State

## Foundation
**FOUNDATION_GREEN**

Evidence:
- PostgreSQL 18 migrations apply, verify, rollback and re-apply in CI.
- Frontend TypeScript + Vite production build is green.
- Backend sqlc compile + gofmt + go vet + go test is green.
- CI is split into Backend / Frontend / Database with path filters and cancel-in-progress.
- Product Blueprint, visual parity, database scalability and resource-budget docs live in this repository.

## Repository
`nasef6464/almeaago` is the only implementation repository.

## Legacy reference
`nasef6464/almeaacodax` remains read-only behavioral and visual reference.

## Current phase
Organizations / Schools / Classes core — **IN_PROGRESS**.

## Identity Core / Recovery / Providers — TESTED / MERGED
Includes:
- email/password, National ID and phone/password login.
- opaque revocable sessions + CSRF.
- Argon2id and login lockout.
- forgot/reset password and email verification.
- Google OAuth implementation.
- WhatsApp OTP implementation.
- explicit provider identities.
- canonical Saudi phone normalization.
- HMAC-peppered OTPs and rate limits.

External staging gates still pending:
- real Google OAuth credentials and live smoke.
- real WhatsApp delivery endpoint/token and live smoke.

## Self Profile / Identity — IMPLEMENTED
Included in the current Identity branch:
- PATCH /api/v1/auth/me/profile
- PATCH /api/v1/auth/me/identity
- profile name/avatar-reference update.
- National ID update/clear with validation and uniqueness.
- Saudi phone canonicalization on update.
- phone update/clear with uniqueness.
- provider-only account cannot remove its final login identity.
- self-update audit events.
- CSRF required for both PATCH routes.

Compatibility aliases retained:
- GET /api/v1/auth/csrf-token
- POST /api/v1/auth/email/resend-verification
- GET /api/v1/auth/google/call

## Identity Admin Accounts — TESTED / MERGED
PR #9 passed Backend + Database CI on the exact tested head and was merged to `main` as `c57d03e726d58eea7605c8ec77d3be29b092bd0b`.

Implemented:
- platform-admin user directory with page/limit/search/role/status filters.
- supervisor/teacher directory constrained to legacy-compatible active school/class scope.
- hard page limit 100.
- trigram-backed name/email search.
- role/status summary.
- admin account create/upsert by email.
- account name/avatar/role/status update.
- normalized school membership synchronization.
- normalized class/group membership synchronization.
- normalized parent/student relationship synchronization.
- bulk activation/deactivation with per-user results.
- user delete.
- CSRF required for all unsafe admin mutations.
- transactional audit logs.
- disabling an account revokes active sessions.
- self-delete blocked.
- last active admin protected on update/upsert/bulk/delete.
- last-admin invariant serialized with a transaction advisory lock.
- legacy last-admin PATCH inconsistency documented and intentionally fixed.
- cross-domain writes delegated to Organizations contract.
- cross-domain user directory reads owned by Reporting read model.
- admin directory does not load password hashes or login/token internals.

Still pending outside this slice:
- trainer managed path/subject scopes.
- platformTrainer filter/count.
- live Google/WhatsApp staging smoke.
- desktop/mobile Auth screenshot parity gate.

Trainer scopes are never silently discarded: unsupported managedPathIds/managedSubjectIds fail explicitly until Catalog/Content ownership is implemented.

## Identity Closure Audit
See `docs/domains/identity/IDENTITY_CLOSURE_AUDIT.md`.

Routes deliberately owned elsewhere:
- preferences -> Learning.
- purchase/redeem -> Commerce.
- parent-facing link/unlink/read flows -> Parents / Organizations.
- trainer directory/performance -> Reporting / Content ownership.
- school/class/group canonical relationship state -> Organizations.

## Organizations Core — TESTED / MERGED
Core school/class/roster/membership/director-delegation/assignment foundation was merged to `main` as `c182892d12ac50f3260b23d7281cba10bb9eb28f`.

## School Director Core — TESTED / MERGED
Merged to `main` as `51c71e830c412386694c20f31e014881ce3d653a`.

Current implementation:
- Migration 000008 for organization delegation/core metadata.
- explicit supervisor scope persistence.
- Operations-owned transactional audit writer.
- Organizations domain/application boundaries.
- scoped PostgreSQL repositories for schools, classes and roster.
- bounded school/class search with supporting indexes.
- admin/supervisor/teacher/school_admin read-policy tests.
- archive lifecycle instead of hard-delete for schools/classes.
- canonical HTTP API under `/api/v1/schools`.
- authenticated school/class/roster reads.
- CSRF-protected school/class mutations.
- platform-admin membership mutation API.
- bounded director delegation directory and permission replacement.
- legacy director default permission set preserved exactly.
- bounded teaching-assignment directory.
- subject-agnostic teaching assignments preserved through nullable PostgreSQL subject scope.
- teacher assignment reads forced to the current teacher.
- school director assignment writes require `SCHOOL_TEACHERS_ASSIGN`.
- Organizations repository is wired through `cmd/api`.

Current green checkpoint before relationship expansion:
- Backend CI green.
- Database CI green.
- Migration 000008 apply/verify/rollback/re-apply green.

Next within this slice:
- re-run Backend/Database gate for relationship expansion.
- school context API.
- school director compatibility workflows.
- teacher workspace compatibility.
- legacy route adapters required by the preserved React UI.
- contract/entitlement APIs in their owning boundary.

## Performance/scalability
- admin directory uses bounded pagination.
- user search uses pg_trgm indexes.
- school-scope lookup has user-first index support.
- directory reads use one paginated read-model query rather than N+1 user hydration.
- mutation audit, identity state and organization scope changes commit atomically.
- provider and OTP lookup paths remain indexed.
- no large media passes through the Go API.

## Active performance hardening
Branch: `perf/organizations-read-indexes`

Migration 000009 adds targeted indexes for school-scoped membership scans, current active class lookup by student, and school-scoped teaching assignments. This is deliberately separate from feature parity work and must pass the existing database apply/verify/rollback/re-apply gate before merge.

## Next exact action
Open/test the organization read-index hardening PR, then continue teacher workspace compatibility without fabricating assessment or entitlement data: those fields must be supplied by their owning domain boundaries.
