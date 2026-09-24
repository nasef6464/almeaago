# Current State

## Foundation
**FOUNDATION_GREEN**

Evidence:
- PostgreSQL 18 migrations are exercised by apply / verify / rollback / re-apply CI.
- Frontend TypeScript + Vite production build is green.
- Backend sqlc compile + gofmt + go vet + go test is green.
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
- login lockout.
- current user / logout.
- normalized roles.

## Identity Recovery — TESTED / MERGED
- enumeration-safe forgot-password.
- one-time hashed reset/verification tokens.
- password reset revokes active sessions.
- resend verification requires session + CSRF.

## Google OAuth + WhatsApp OTP — TESTED / MERGED
PR #6 passed Backend + Frontend + Database CI and was merged.

Implemented:
- Google OAuth authorization + callback adapter.
- HttpOnly short-lived OAuth state cookie.
- internal-only returnTo validation.
- verified Google email requirement.
- explicit Google provider identity.
- WhatsApp OTP webhook adapter.
- random six-digit OTP.
- HMAC-SHA256 OTP digest with external pepper.
- 10-minute OTP TTL.
- three sends per 15 minutes.
- five verification attempts.
- provider-only account without fake email/password.
- legacy send -> code -> verify -> resend UI flow.

Still pending external staging configuration:
- real Google OAuth credentials.
- production OTP pepper.
- real WhatsApp delivery endpoint/token.
- live provider smoke test.

## Auth UI — BUILD TESTED / MERGED
- legacy-compatible Tailwind theme.
- login/register modal structure preserved.
- recovery screens preserved.
- Google/WhatsApp entry points wired.
- RTL/loading/error/disabled states.
- desktop/mobile screenshot comparison remains required before PARITY_PROVEN.

## Identity Admin Accounts — IMPLEMENTED / CI PENDING
Branch: `feat/identity-admin`

Implemented in this slice:
- platform-admin user directory with page/limit/search/role/status filters.
- hard page limit 100.
- trigram-backed name/email search.
- role/status summary.
- admin account create/upsert by email.
- account name/avatar/role/status update.
- bulk activation/deactivation with per-user results.
- user delete.
- CSRF required for all unsafe admin mutations.
- transactional audit logs.
- disabling an account revokes active sessions.
- self-delete blocked.
- last active admin protected on update/upsert/bulk/delete.
- last-admin invariant serialized with a transaction advisory lock.
- legacy last-admin PATCH inconsistency documented and intentionally fixed.

Deliberately pending for Organizations/Trainer scopes:
- schoolId synchronization.
- class/group membership mapping.
- parent/student relationship synchronization.
- trainer managed path/subject scopes.
- supervisor/teacher scoped user directory.
- platformTrainer filter/count.

These fields are never silently discarded. Unsupported scope writes fail explicitly until their owning domain is implemented.

## Performance/scalability
- admin directory uses bounded pagination.
- user search uses pg_trgm indexes.
- list roles are returned without N+1 queries.
- mutation audit and account state changes commit atomically.
- provider and OTP lookup paths remain indexed.
- no large media passes through the Go API.

## Next exact action
Run Backend + Database CI for the Identity Admin branch, repair failures on the same branch, merge the exact tested SHA, then close the remaining Identity visual/live-provider gates and move into Organizations/Schools/Classes.
