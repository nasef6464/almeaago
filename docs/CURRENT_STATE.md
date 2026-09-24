# Current State

## Foundation
**FOUNDATION_GREEN**

Evidence:
- Database CI: PostgreSQL 18 migrations apply, rollback and re-apply successfully.
- Frontend CI: TypeScript + Vite production build green.
- Backend CI: sqlc compile + gofmt + go vet + go test green.
- CI split into Backend / Frontend / Database with path filters and cancel-in-progress.
- Product Blueprint, project map, visual parity, resource budget and governance docs live in this repository.

## Repository
`nasef6464/almeaago` is the only implementation repository.

## Legacy reference
`nasef6464/almeaacodax` remains read-only behavioral and visual reference.

## Current phase
Identity/Auth — **IN_PROGRESS**.

## Identity Core — TESTED
Merged into main:
- normalized user roles.
- email/password registration and login.
- Saudi National ID login.
- opaque revocable sessions.
- CSRF token bound to session.
- Argon2id password hashing.
- account lockout foundation.
- current user.
- logout.
- indexed session lookup.
- bounded last_seen writes.
- OpenAPI contract.

## Identity Recovery — IMPLEMENTED / CI PENDING
Branch: `feat/identity-recovery`

Includes:
- generic forgot-password response.
- one-time hashed password reset tokens.
- one-time hashed email verification tokens.
- 60-minute password reset TTL.
- 24-hour email verification TTL.
- reset revokes all active sessions.
- resend verification requires authenticated session + CSRF.
- delivery is provider-agnostic; no external email account required yet.
- recovery token lookup indexes.
- migration up/down coverage.
- unit tests for raw-token non-persistence.

## Still pending in Identity
- Google OAuth.
- WhatsApp OTP.
- phone/password login parity if retained by legacy UI flow.
- external email/WhatsApp delivery adapters.
- admin account-management operations.
- Auth frontend visual parity.

## Visual rule
Auth UI must reproduce the legacy modal and recovery screens before Identity reaches PARITY_PROVEN.

## Next exact action
Open Identity Recovery PR, require Backend + Database CI green, merge at verified head SHA, then start Auth frontend visual-parity slice.
