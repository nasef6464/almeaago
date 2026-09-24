# Current State

## Foundation
**FOUNDATION_GREEN**

Evidence:
- Database CI: PostgreSQL 18 migrations apply, rollback and re-apply successfully.
- Frontend CI: TypeScript + Vite production build green for the foundation.
- Backend CI: sqlc compile + gofmt + go vet + go test green.
- CI split into Backend / Frontend / Database with path filters and cancel-in-progress.
- Product Blueprint, project map, visual parity, database scalability and resource-budget docs live in this repository.

## Repository
`nasef6464/almeaago` is the only implementation repository.

## Legacy reference
`nasef6464/almeaacodax` remains read-only behavioral and visual reference.

## Current phase
Identity/Auth — **IN_PROGRESS**.

## Identity Core — TESTED / MERGED
- normalized user roles.
- email/password registration and login.
- Saudi National ID login.
- opaque revocable sessions.
- CSRF token bound to session.
- Argon2id password hashing.
- account lockout.
- current user.
- logout.
- indexed session lookup.
- bounded last_seen writes.
- OpenAPI contract.

## Identity Recovery — TESTED / MERGED
- enumeration-safe forgot-password.
- one-time hashed password reset tokens.
- one-time hashed email verification tokens.
- 60-minute password reset TTL.
- 24-hour verification TTL.
- reset revokes active sessions transactionally.
- resend verification requires session + CSRF.
- query-driven indexes.
- Backend + Database CI green.

## Auth UI Visual Parity — IMPLEMENTED / CI PENDING
Branch: `feat/auth-ui-parity`

Implemented:
- Tailwind 3.4-compatible legacy theme.
- React Router auth routes.
- auth API client with credential cookies.
- in-memory CSRF handling; no session/local storage tokens.
- legacy-shaped login/register modal.
- smart identity input for email / Saudi National ID / phone detection.
- Google button preserved visually.
- WhatsApp/phone entry preserved visually.
- Forgot Password page copied from legacy visual contract.
- Reset Password page copied from legacy visual contract.
- Verify Email page copied from legacy visual contract.
- same RTL, modal geometry, colors, validation/error/loading states.

Pending before Visual Parity can be claimed:
- Frontend CI.
- browser screenshot comparison desktop/mobile.
- Google OAuth backend.
- phone/password + WhatsApp OTP backend.
- full legacy Header/Homepage migration; current shell is temporary and is NOT parity-proven.

## Performance/scalability
Database and hot-endpoint budgets are documented. Query-driven indexing is required; speculative indexes are intentionally avoided.

## Next exact action
Open Auth UI PR, require Frontend CI green, repair any TypeScript/Vite failure, then perform visual browser comparison before merge or mark exact remaining visual gaps.
