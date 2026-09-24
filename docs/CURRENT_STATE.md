# Current State

## Foundation
**FOUNDATION_GREEN**

Evidence:
- Backend CI: module lock + sqlc + gofmt + go vet + go test green.
- Frontend CI: TypeScript + Vite production build green.
- Database CI: PostgreSQL 18 migrations apply, rollback and re-apply.
- CI is split and path-filtered to reduce GitHub Actions consumption.

## Repository
`nasef6464/almeaago` is the only implementation repository.

## Legacy reference
`nasef6464/almeaacodax` is read-only behavioral and visual reference.

## Identity Core
**MERGED_GREEN** at main commit `86d7b14ff8ea7483ca06f55be410a079f7c45789`.

Implemented and verified:
- normalized user auth state.
- explicit user roles.
- opaque revocable sessions.
- per-session CSRF binding.
- email/password register/login.
- Saudi National ID login.
- account lockout foundation.
- Argon2id versioned password hashing.
- PostgreSQL persistence.
- OpenAPI core auth contract.

## Current branch
`feat/identity-security-recovery`

## Current slice
Identity Security + Recovery — **IMPLEMENTED / CI PENDING**.

Implemented on branch:
- one-time hashed recovery/verification tokens.
- atomic registration + verification-token creation.
- password reset consumes token once and revokes all old sessions.
- email verification + resend lifecycle.
- phone + password login.
- timing-side-channel mitigation for unknown accounts.
- password hash automatic upgrade path.
- auth responses omit national ID/phone by default.
- Cache-Control no-store for auth.
- strict CORS allow-list support.
- API security headers.
- application and HTTP security tests.
- migration 004.
- Database CI now includes migration 004 and avoids redundant heavy PR reruns where possible.

## Not PARITY_PROVEN yet
- real email delivery adapter/outbox is not wired; current development delivery is a no-op adapter.
- Google OAuth not implemented in V2 yet.
- WhatsApp OTP not implemented in V2 yet.
- Auth frontend visual parity not implemented yet.
- full E2E on a deployed staging environment not run yet.

## Next exact action
Open one PR for the completed security/recovery batch, run Backend + Database gates once, fix any failures, then merge only if green. After merge: Google OAuth + WhatsApp OTP + phone identity management, then legacy-matching Auth UI.
