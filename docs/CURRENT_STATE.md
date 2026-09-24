# Current State

## Foundation
**FOUNDATION_GREEN**

Evidence:
- Database CI: PostgreSQL 18 migrations apply, rollback and re-apply successfully.
- Frontend CI: TypeScript + Vite production build green.
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
- email/password registration/login.
- Saudi National ID login.
- opaque revocable sessions.
- per-session CSRF.
- Argon2id password hashing.
- lockout after repeated failures.
- current user / logout.
- normalized roles.

## Identity Recovery — TESTED / MERGED
- enumeration-safe forgot-password.
- one-time hashed reset/verification tokens.
- password reset revokes active sessions.
- resend verification requires session + CSRF.
- query-driven recovery indexes.

## Auth UI — BUILD TESTED / MERGED
- legacy-compatible Tailwind theme.
- login/register modal structure preserved.
- recovery/verification screens preserved.
- RTL/loading/error/disabled states.
- Frontend TypeScript + Vite build green.
- screenshot desktop/mobile comparison still required before PARITY_PROVEN.
- full legacy Header/Homepage remains a later visual slice.

## Identity Provider Foundation — IMPLEMENTED / CI PENDING
Branch: `feat/identity-providers`

Includes:
- provider-only users can exist without fake email/password values.
- external identities are explicit in `auth_provider_identities`.
- OTP challenges have a dedicated short-lived table.
- Saudi mobile canonicalization: 05xxxxxxxx -> 9665xxxxxxxx.
- phone/password login uses the same lockout/session/CSRF path as other password login.
- UI smart phone login now calls the real phone-password endpoint.
- provider tables and hot lookup indexes are migration-tested by CI definition.

Still pending:
- Google OAuth network adapter and callback.
- WhatsApp OTP delivery adapter/challenge lifecycle.
- actual external provider credentials.
- browser visual screenshot gate.

## Performance/scalability
- database scalability policy is mandatory.
- indexes are tied to real queries, not added speculatively.
- auth provider lookup uses unique/partial indexes.
- media and high-volume domains remain subject to bandwidth/query budgets.

## Next exact action
Open the provider-foundation PR, require Backend + Database + Frontend CI green, merge exact tested SHA, then implement Google OAuth + WhatsApp OTP on top of the provider identity tables.
