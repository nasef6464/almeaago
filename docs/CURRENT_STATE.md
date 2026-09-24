# Current State

## Phase
Foundation Release 0 — **FOUNDATION_GREEN**.

## Evidence
- Database CI: migrations apply, rollback, re-apply successfully on PostgreSQL 18.
- Frontend CI: TypeScript check + Vite production build green.
- Backend CI: sqlc compile + gofmt + go vet + go test green.
- CI split into Backend / Frontend / Database with path filters and cancel-in-progress.
- Product Blueprint, project map, visual parity, resource budget and governance docs live in this repository.

## Repository
`nasef6464/almeaago` is the only implementation repository.

## Legacy reference
`nasef6464/almeaacodax` remains read-only behavioral and visual reference.

## Current phase
Identity/Auth — DISCOVERY COMPLETE / IMPLEMENTATION STARTING.

## Auth baseline discovered
Email/password, registration, Google OAuth, WhatsApp OTP, Saudi National ID login, logout, current user, password recovery, email verification, lockout after repeated failures, cookie-first auth.

## Next exact action
Implement Identity/Auth backend foundation with normalized PostgreSQL state, opaque revocable sessions, Argon2id passwords, recovery tokens, CSRF and contract tests. Then reproduce the legacy Auth UI with visual parity.
