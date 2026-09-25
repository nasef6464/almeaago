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
Identity/Auth closure — **IN_PROGRESS**.

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

## Identity Admin Accounts — IMPLEMENTED / CI PENDING
Branch: `feat/identity-admin`

Implemented in this slice:
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

## Performance/scalability
- admin directory uses bounded pagination.
- user search uses pg_trgm indexes.
- school-scope lookup has user-first index support.
- directory reads use one paginated read-model query rather than N+1 user hydration.
- mutation audit, identity state and organization scope changes commit atomically.
- provider and OTP lookup paths remain indexed.
- no large media passes through the Go API.

## Next exact action
Run Backend + Database CI for `feat/identity-admin`, repair failures on the same branch, merge the exact tested SHA, then begin Organizations/Schools/Classes while keeping visual/provider/trainer-scope gates tracked.
