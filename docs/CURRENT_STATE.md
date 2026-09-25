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
`nasef6464/almeaacodax` is read-only behavioral and visual reference. No implementation work is merged there as part of ALMEAA Go.

## Current phase
Organizations / Schools / Classes compatibility — **IN_PROGRESS**.

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
- platform-admin user directory with bounded pagination/search/role/status filters.
- supervisor/teacher directory constrained to active school/class scope.
- normalized school, class/group and parent/student relationship synchronization.
- admin account create/update/bulk activation/deactivation/delete.
- CSRF on unsafe mutations and transactional audit logs.
- disabling an account revokes active sessions.
- self-delete and last-active-admin protections.
- Organizations owns cross-domain relationship writes.
- Reporting owns cross-domain directory read models.

Still pending outside this slice:
- trainer managed path/subject scopes.
- platformTrainer filter/count.
- live Google/WhatsApp staging smoke.
- desktop/mobile Auth screenshot parity gate.

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

## School Director Core Compatibility — MERGED TO MAIN
Latest main checkpoint: `51c71e830c412386694c20f31e014881ce3d653a`.

Implemented in main:
- Migration 000008 organization delegation/core metadata.
- explicit supervisor scope persistence.
- Operations-owned transactional audit writer.
- Organizations domain/application boundaries.
- scoped PostgreSQL repositories for schools, classes and roster.
- bounded school/class search with supporting indexes.
- archive lifecycle for schools/classes.
- canonical HTTP API under `/api/v1/schools`.
- authenticated school/class/roster reads and CSRF-protected mutations.
- platform-admin membership mutation API.
- director delegation directory and permission replacement.
- legacy director default permission set.
- teaching-assignment directory with nullable subject scope.
- school director student list/add/update/activate/move-class workflows.
- school director class create/update workflows.
- school director teacher/assignment workflows.
- legacy-compatible director adapters required by the preserved React UI.
- Reporting-owned school director read model.
- Identity-owned student account writes.
- parity-safe bounded director rosters.

Branch note:
- `feat/organizations-core` has no unmerged commits and is behind `main`; do not use it as the source of new work.

Verification note:
- GitHub's PR-scoped workflow lookup returns no workflow runs for the direct main commit `51c71e...`.
- Do not label this commit as exact-head CI verified until a new PR/CI checkpoint supplies that evidence.

## Performance/scalability
- bounded pagination for admin/director directories.
- pg_trgm-backed user search.
- user-first school-scope indexes.
- paginated read models instead of N+1 user hydration.
- atomic audit/identity/organization mutations.
- indexed provider and OTP lookup paths.
- no large media passes through the Go API.

## Engineering workflow
- Build foundation-first by domain boundary; do not implement unrelated product features early.
- New implementation work starts from current `main` on a fresh focused branch.
- Keep changes reviewable and domain-scoped.
- Run relevant Backend / Database / Frontend gates on the exact PR head before merge.
- Merge only after required gates are green; update this file after each verified checkpoint.
- Use `almeaacodax` only for explicit behavioral/visual parity checks, never as an implementation target.

## Next exact action
Start a fresh branch from current `main` for the remaining Organizations compatibility slice. First inventory the Organizations routes/workflows already present on `main` against the ALMEAA Go architecture/product sources, then implement only the missing school-context and teacher-workspace compatibility contracts. Keep contract/entitlement work in its owning boundary. Open a focused PR and require exact-head Backend + Database CI before merge.
