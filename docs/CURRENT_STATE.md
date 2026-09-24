# Current State

## Foundation
**FOUNDATION_GREEN**

Evidence:
- PostgreSQL 18 migrations apply, verify, rollback and re-apply in CI.
- Frontend TypeScript + Vite production build green.
- Backend sqlc compile + gofmt + go vet + go test green.
- CI split into Backend / Frontend / Database with path filters and cancel-in-progress.
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
- production OTP pepper.
- real WhatsApp delivery endpoint/token and live smoke.

## Identity Admin Accounts — TESTED / MERGED
PR #7 passed Backend + Database CI and was merged.

Includes:
- bounded paginated admin user directory.
- trigram name/email search.
- role/status filters and summary.
- create/upsert/update/bulk-status/delete.
- transactional audit log.
- session revocation on disable.
- self-delete protection.
- concurrency-safe last-active-admin protection.
- explicit fail-closed boundaries for organization-owned fields.

## Self Profile / Identity — IMPLEMENTED / CI PENDING
Branch: `feat/identity-account-profile`

Includes:
- PATCH /api/v1/auth/me/profile
- PATCH /api/v1/auth/me/identity
- profile name/avatar-reference update.
- National ID update/clear with validation and uniqueness.
- Saudi phone canonicalization on update.
- phone update/clear with uniqueness.
- provider-only account cannot remove its final login identity.
- self-update audit events.
- CSRF required for both PATCH routes.

Compatibility aliases:
- GET /api/v1/auth/csrf-token
- POST /api/v1/auth/email/resend-verification
- GET /api/v1/auth/google/call

## Identity Closure Audit
See `docs/domains/identity/IDENTITY_CLOSURE_AUDIT.md`.

Routes deliberately moved out of Identity:
- preferences -> Learning.
- purchase/redeem -> Commerce.
- parent linking -> Parents / Organizations.
- trainer directory/performance -> Organizations / Reporting.
- school/class/group/user scope synchronization -> Organizations.

## Visual / External gates
Still required before Identity can be PARITY_PROVEN:
- desktop/mobile Auth screenshot comparison.
- live Google smoke on staging.
- live WhatsApp OTP smoke on staging.
- organization-owned auth-era flows proven in their destination domains.

## Next exact action
Run Backend CI for the account-profile closure branch, repair any failure, merge the exact tested SHA, then begin Organizations/Schools/Classes while keeping the visual/provider gates tracked.
