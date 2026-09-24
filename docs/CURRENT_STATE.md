# Current State

## Foundation
**FOUNDATION_GREEN**

Evidence:
- Database CI: PostgreSQL 18 migrations apply, rollback and re-apply successfully.
- Frontend CI: TypeScript + Vite production build green.
- Backend CI: sqlc compile + gofmt + go vet + go test green.
- CI is split into Backend / Frontend / Database with path filters and cancel-in-progress.
- Product Blueprint, visual parity, database scalability and resource-budget docs live in this repository.

## Repository
`nasef6464/almeaago` is the only implementation repository.

## Legacy reference
`nasef6464/almeaacodax` remains read-only behavioral and visual reference.

## Current phase
Identity/Auth — **IN_PROGRESS**.

## Identity Core — TESTED / MERGED
- email/password registration and login.
- Saudi National ID login.
- phone/password login.
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
- phone/password connected to real backend.
- screenshot desktop/mobile comparison still required before PARITY_PROVEN.

## Identity Provider Foundation — TESTED / MERGED
- provider-only users can exist without fake email/password values.
- external identities are explicit in `auth_provider_identities`.
- OTP challenges are separate short-lived authentication evidence.
- Saudi phone numbers are canonicalized to 9665xxxxxxxx.
- provider lookup and OTP history have query-driven indexes.

## Google OAuth + WhatsApp OTP — IMPLEMENTED / CI PENDING
Branch: `feat/identity-oauth-otp`

Implemented:
- Google OAuth authorization + callback adapter.
- 10-minute HttpOnly OAuth state cookie.
- internal-only returnTo validation.
- verified Google email required before account resolution.
- Google subject binds to explicit provider identity.
- WhatsApp OTP provider adapter through configurable webhook.
- cryptographically random 6-digit OTP.
- HMAC-SHA256 OTP digest with external pepper; plaintext OTP is never persisted.
- 10-minute OTP TTL.
- maximum 3 OTP sends per 15 minutes per canonical phone.
- maximum 5 verification attempts per challenge.
- used/failed-delivery challenges cannot authenticate.
- WhatsApp-only account does not require fake email or fake password.
- legacy OTP UI flow restored: send -> code -> verify -> resend.
- Google callback restores the requested internal path after /me resolves.

External configuration still pending:
- real Google OAuth client credentials.
- real WhatsApp delivery endpoint/token.
- production OTP pepper.
- live provider smoke test on staging.
- screenshot visual parity gate.

## Performance/scalability
- database scalability policy is mandatory.
- OTP rate-limit query uses phone/channel/created_at history index.
- provider subject lookup is unique and indexed.
- no provider login performs broad user scans.
- external provider network calls have bounded HTTP timeouts.

## Next exact action
Run Backend + Database + Frontend CI for the OAuth/OTP branch. Repair any gate failure on the same branch, merge the exact tested SHA, then move to Identity admin-account operations and the Auth screenshot parity gate.
