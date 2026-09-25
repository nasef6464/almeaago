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
Organizations / Schools / Classes compatibility — **STRUCTURAL CHECKPOINT GREEN**.

Taxonomy — **STRUCTURAL CHECKPOINT GREEN**.

Question Bank — **STRUCTURAL CHECKPOINT GREEN**.

Media / R2 — **DIRECT-UPLOAD FOUNDATION GREEN**.

Content / Foundation backend — **CORE MANAGEMENT TESTED / MERGED**.

Content React cutover — **TESTED / VISUAL CHECKPOINT GREEN (PR #38 PRE-MERGE)**.

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

## Teacher Workspace — TESTED / MERGED
PR #14 passed exact-head Backend CI and merged as `f9664d6fe894475685bd51016d96f96a3c554238`.

Implemented:
- teacher-only scoped workspace.
- active membership + active assignment + active school/class enforcement.
- multi-school class/subject projection with aggregate student counts.
- no student PII or cross-domain assessment/commerce/realtime/reporting payload coupling.

## Parent Authority — TESTED / MERGED
PR #15 passed exact-head Backend CI and merged as `955b27d14e137ad85d4747eddc5d83d8b198d749`.

Implemented:
- canonical `parent_student_relationships` authority read.
- dedicated `GET /api/v1/parents/authority` facade.
- active parent→student relationships only.
- no student profile/progress/PII leakage from Organizations.
- existing admin account synchronization remains the canonical relationship writer.

Security decision:
- legacy self-linking by knowledge of National ID/phone is **not** copied as authority.
- a future self-service claim flow requires explicit verification/consent policy; identifier knowledge alone is insufficient.

## Organizations read-path indexes — TESTED / MERGED
PR #12 passed Database CI and merged as `23e52df7247b3f4371b895249bcfde0b208579a9`.

## Organizations checkpoint
The structural Organizations foundation is now green for:
- schools, memberships and delegated director permissions.
- classes and class memberships.
- teaching assignments and teacher workspace.
- bounded rosters/directories.
- supervisor scopes.
- canonical parent/student authority.
- archive/revocation behavior and supporting read indexes.

Commercial school contracts/modules/entitlements are not moved into Organizations. Commerce owns entitlement/access state and will integrate through explicit contracts.

## Taxonomy Foundation — TESTED / MERGED
Schema normalization PR #17 passed exact-head Database CI and merged as `968f545727c4bfcbaacd8b2a75fdd951ee65aae1`.

Public bootstrap PR #18 passed exact-head Backend CI and merged as `b68287cbbcb45909529d0f2ea3acfb05970bfedb`.

Implemented:
- hierarchical paths with lifecycle/order metadata.
- relational levels.
- optional subject→level hierarchy and subject lifecycle/order.
- relational main/sub skill hierarchy retained; skill lifecycle/description added.
- restrictive taxonomy references instead of legacy destructive cascade behavior.
- public `GET /api/v1/taxonomy/bootstrap` with core/compact/full phases.
- active-ancestor filtering and stable normalized DTOs.
- no legacy embedded `subSkills[]`, `questionIds[]`, or `lessonIds[]` ownership arrays.
- PostgreSQL remains taxonomy truth; no runtime auto-seeding as a correctness dependency.

## Taxonomy Admin Mutations — TESTED / MERGED
PR #20 passed exact-head Backend CI and merged as `e488acf47723e15f801d24a61f8afd34f18e95c8`.

Implemented:
- platform-admin-only create/update contracts for paths, levels, subjects and skills.
- CSRF on all taxonomy mutations.
- stable create-only codes and stable IDs.
- active path/level/subject and main/sub skill hierarchy validation.
- lifecycle updates through active/inactive/archived; no destructive taxonomy delete API.
- transaction-scoped audit records.
- explicit conflict/not-found mapping and bounded input normalization.
- Taxonomy remains hierarchy-only; no question/content ownership arrays.

## Taxonomy checkpoint
The structural Taxonomy foundation is green for normalized persistence, bounded public bootstrap reads, stable hierarchy identity, and lifecycle-safe admin mutation contracts. Content and Question Bank may now depend on Taxonomy IDs through explicit boundaries.

## Question Bank Foundation Schema — TESTED / MERGED
PR #22 passed exact-head Database CI and merged as `f93b3e21c66a22c2a4f7d9b19bc81a13c7f53525`.

Implemented:
- immutable question_code enforcement in PostgreSQL.
- deferred current-version integrity to question_versions.
- question path/subject classification and reviewer/assignment metadata.
- option/correct-index integrity constraints.
- query-oriented workflow/taxonomy/owner/media indexes.
- revision author/note metadata.
- rollback-safe migration.

## Question Bank Core API — TESTED / MERGED
PR #23 passed exact-head Backend CI and merged as `4e219ddcee95ede1cb75bd685312c87258556b27`.

Implemented:
- stable question identity with immutable version history.
- text-only, image-only, and text+image question authoring.
- compact AI-readiness metadata for readable/speech/visual/option/math/context fields without routing image bytes through the Go API.
- embedded-image option questions require textual option representations for AI/accessibility.
- Taxonomy-validated relational main/sub/secondary skill links.
- optimistic append-version flow.
- explicit draft/pending_review/approved/rejected/archived workflow.
- teacher owner/assignment edit scope; teachers cannot approve their own questions.
- admin workflow transitions are explicit; draft cannot silently jump directly to approved.
- approved learner-safe projection strips answer keys, explanation/hint/strategy, full AI/source metadata, reviewer notes and voice authoring metadata.
- active asset references only; Media/R2 owns image bytes.
- CSRF on unsafe question mutations and transaction-scoped audit records.

## Question Bank Staff Filters & Coverage — TESTED / MERGED
Search/filter index PR #25 passed exact-head Database CI and merged as `0846ba302f6beff0542eb94fb4d1ffcd0f99c13b`.

Staff filter/coverage PR #26 passed exact-head Backend CI and merged as `1e3cc4bed6d262f382a0e551884499f41f228c0c`.

Implemented:
- default list limit 80 / max 100 with hasMore, not exact counts on every list request.
- path/subject/main-skill/multi-skill/linked/difficulty/type/exam/source/year/workflow/video/explanation/search filters.
- teacher list scope forcibly constrained to owned/assigned questions.
- summary DTOs avoid full-question N+1 hydration.
- separate filtered coverage endpoint.
- distinct question totals for multi-skill questions.
- approved/pending/unlinked/main-skill/subskill coverage.
- independently paginated per-skill counts.
- trigram/search and video-presence indexes for the hot filter paths.

## Media / R2 Direct Upload — TESTED / MERGED
Lifecycle schema PR #27 passed exact-head Database CI and merged as `e88fd81c5dd014a9b9521485ccae5a4fe3c025c1`.

Direct-upload API PR #28 passed exact-head Backend CI and merged as `56eb659b40d1014beaacab1881c909cd33de07b1`.

Implemented:
- pending_upload -> verified active asset lifecycle.
- SHA-256 live dedupe and pending-expiry lookup.
- staff-only CSRF-protected presigned PUT flow.
- direct browser -> R2 binary upload; image/audio bytes do not pass through Go.
- signed MIME, immutable cache policy and x-amz-meta-sha256.
- authenticated R2 HEAD completion verification for size/MIME/hash.
- hash-addressed question image keys `questions/v2/{QUESTION_CODE}/{SHA256}.{ext}`.
- question image MIME: JPEG/PNG/WebP; explanation audio MIME bounded separately.
- backend-only R2 credentials.
- configurable upload byte limit and presign TTL.
- active asset metadata read endpoint.
- duplicate `/api/v1/questions` HTTP mount discovered during review was removed.

External staging gates:
- real R2 account/bucket credentials.
- bucket CORS allowing the returned signed PUT headers.
- `R2_PUBLIC_BASE_URL`/CDN delivery smoke.
- real upload -> HEAD verify -> question render smoke.

## Question Bank V2 Import — TESTED / MERGED
Durable provenance schema PR #30 passed exact-head Database CI and merged as `df0569d5dad00c4bd83ca289497d62a115c843c7`.

Durable preflight schema PR #32 passed exact-head Database CI and merged as `936f2f9decd6c040584047d87e2b97d89b583fc6`.

V2 import API PR #31 passed exact-head Backend CI and merged as `38ef2b5737a60cd11054552d3db4e66941a8c3a2`.

Implemented:
- platform-admin-only V2 quantitative import with CSRF on write/rollback.
- strict 8..160 batch identity and maximum 100 items.
- deterministic `QDR-QNT-{DOCUMENT_CODE}-P###-Q##` identity plus canonical sourceItemId coordinates.
- duplicate questionCode/sourceItemId/imageHash detection in-batch and against PostgreSQL.
- verified active WebP asset must match questionCode + SHA-256 R2 object identity.
- exact normalized manifest SHA-256 stored as an expiring PostgreSQL preflight; write cannot bypass or reuse a changed/expired dry run.
- taxonomy and media integrity are revalidated before/inside the write transaction.
- all-or-nothing draft-only platform-owned writes with provenance, immutable version/options, skill links and audit.
- no auto-approval.
- durable batch/report/preflight/commit timestamps.
- rollback archives an all-draft batch rather than deleting stable question identity/history.
- import endpoint receives metadata/asset IDs only; image bytes remain direct-to-R2.
- AI-readable text/context remains versioned server-side so routine AI use does not require downloading the image.

## Question Bank checkpoint
Question Bank is structurally green for:
- stable identity and immutable version history.
- text/image/mixed authoring.
- AI-readiness metadata and learner answer secrecy.
- Taxonomy skill relationships.
- bounded staff filters and separate coverage counters.
- Media/R2 direct upload and SHA-256 dedupe.
- dry-run-first V2 import and archive-safe rollback.

Reuse contracts for Assessment/Realtime/Learning will consume canonical question IDs later; those domains must not copy question objects.

## Content Core Management — TESTED / MERGED
PR #37 passed exact-head Backend CI and Database CI on `0c493741ccae5e241b1eadb9555bf3a49ce573e8` and merged to `main` as `3a13259401f6328ce65e4b74532ed46dfe635302`.

Implemented:
- normalized PostgreSQL Content persistence for courses, lessons, Foundation topics and library items.
- bounded staff lists with compact DTOs and no exact-count work on normal list paths.
- canonical platform-trainer authoring scope plus exact Organizations teaching-assignment composition for school teachers.
- teacher ownership/assignment authority; `created_by` remains audit provenance only.
- optimistic revisions, lifecycle/workflow guards, CSRF-protected mutations and transaction-scoped audit.
- course modules/lesson placement and Foundation lesson/library placement with bounded composition reads.
- explicit course publication separated from approval and visibility.
- learner-safe bounded learning-space/course/Foundation projections without leaking content bodies, answer/access authority, ownership or revenue metadata.
- legacy admin `managedPathIds`/`managedSubjectIds` compatibility adapted transactionally to Content-owned trainer scope.
- Question Bank authoring consumes the same combined teacher scope.
- no Vercel/Render deployment changes.

Cross-domain / product deferrals after Content closure:
- Commerce entitlement/access resolution remains owned by Commerce/Access.
- Assessment placements remain owned by Assessment and will reference canonical Content/Question Bank IDs rather than embed copies.
- Media/R2 asset-picker UI remains a Media-owned cutover; Content preserves asset references and never proxies large binary bytes through Go.
- legacy bulk XLSX import/export requires a bounded server-side preview/validation contract before restoration; the old full-inventory browser pattern will not be copied.
- richer in-video question authoring belongs to Question Bank/Assessment integration, not duplicated Content state.
- approved-content editing remains intentionally fail-closed until the product/versioning policy is explicitly finalized.

## Content Web Cutover — TESTED / VISUAL CHECKPOINT GREEN (PRE-MERGE)
PR #38 (`feat/content-web-cutover`) is the active Content React parity branch and has reached its merge gate.

Implemented so far:
- role-aware `/admin-dashboard/content` route.
- bounded Course/Lesson/Foundation/Library staff lists backed by the Go API.
- exact path+subject requirement in the UI before school-teacher list requests.
- core Taxonomy bootstrap for list filters; full skills bootstrap is loaded only inside authoring/edit flows.
- secure CSRF-backed Course draft creation, detail/edit flow, workflow controls and admin-only publication control.
- Course curriculum builder backed by canonical module/lesson-placement IDs and optimistic parent revision updates; no embedded lesson copies.
- bounded same-taxonomy lesson search for course placement, including explicit free-preview placement state.
- Lesson create/edit flow for text, assignment, video and live-meeting variants, with workflow review controls and server-owned Media references preserved.
- Library create/edit flow with workflow review controls; large binary bytes remain in Media/R2 and do not pass through Go.
- Foundation admin create/edit flow with stable code behavior plus optimistic lesson/library placements.
- Foundation parent/lesson/library selectors use independent bounded server-side search instead of loading the full inventory.

Verification:
- Frontend CI passed on `51059ab81203219e557072b2877d0ffa4c690862` for the initial bounded read slice.
- Frontend CI passed on `4e9968c12d88f7ce589a6bc0e3846a0027cc45dc` for secure Course draft creation.
- Frontend CI passed on `7452d603c142d21af0bcad3f6681c7b1e156775d` for Course workflow/publication controls.
- Frontend CI passed on `c73f81d6b37dfceceeb4fb230196323537dc5dc3` for Course edit + curriculum builder.
- Frontend CI passed on `17e8ad5c6e6eb89052d749a06c87d3fc67d9ce86` for Lesson authoring/review.
- Frontend CI passed on `c00ee648a816844f9383a9d3378bf94519bd5e41` for Library + Foundation management flows before bounded selector search refinement.
- Representative visual alignment landed on `9c92769f6c64c3815782d65f75aed9c1fe548778`; Frontend CI run `36163074967` passed and Frontend E2E run `36163074657` passed 4/4.
- Browser evidence artifact `10875638539` contains the current desktop Course-builder and mobile Lesson-builder screenshots.
- The final documentation/assertion head must pass Frontend CI + Frontend E2E again before merge; PR #38 must be merged only with that exact tested SHA.

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
Close PR #38 only after the final documentation/assertion head passes both Frontend CI and Frontend E2E on that exact SHA. After merge, update this file on a docs-only checkpoint branch with the merge commit, then begin Phase 6 Assessment from current `main`: audit the legacy Assessment contracts against the blueprint and existing canonical Question Bank/Content IDs, design normalized PostgreSQL assessment identities/attempt state deliberately, and do not copy question/content payloads into Assessment. Keep learner answer secrecy, bounded reads, optimistic/audited staff mutations, and Commerce/Learning boundaries explicit.