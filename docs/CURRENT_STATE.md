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

Content React cutover — **TESTED / VISUAL CHECKPOINT GREEN / MERGED**.

Assessment foundation schema — **TESTED / MERGED**.

## Active batch — Assessment Definition / Version API
PR #42 — Assessment Definition / Version API — **TESTED / MERGED**.

Implemented:
- Assessment domain model with explicit owner, workflow, revision and immutable version composition.
- Admin/teacher application authorization with bounded list pagination (default 50, max 100).
- teacher authoring constrained by active path/subject scope; teacher ownership is server-normalized.
- explicit review workflow; teachers cannot approve; publication is admin-only and requires approved content with questions.
- exact Question Bank references use `question_id + question_version`; question data is not duplicated.
- PostgreSQL repository validates Taxonomy/Question Bank references and writes definition/version/sections/question placement transactionally.
- optimistic revision conflicts are explicit.
- assessment mutations require transaction-scoped Operations audit writes.
- secured HTTP transport mounted at `/api/v1/assessments`; unsafe routes require CSRF.
- request bodies are bounded and unknown JSON fields are rejected.
- list reads use bounded `limit + 1` pagination and avoid mandatory exact-count scans.

Verification:
- one-shot gofmt automation completed and removed itself.
- Backend CI passed on implementation SHA `688a503774d865094e31f1dc8bffe067b7aed2c7`.
- final documentation-inclusive head `cf43f141c4102997f9d8c029d9fe504b21d9f0be` passed Backend CI.
- no Vercel or Render deployment is part of this batch.

Merge evidence:
- PR #42 merged only after the exact head above was Green and mergeable.
- squash merge on `main`: `0348540c024c1fb0d1fb5e93fa230140304ca1ae`.

Next gate:
1. begin the next parity batch from `main` only;
2. keep `almeaacodax` as read-only behavioral/visual reference;
3. preserve the same contract -> implementation -> exact-head CI -> documentation -> merge discipline.

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

## Content Web Cutover — TESTED / VISUAL CHECKPOINT GREEN / MERGED
PR #38 passed the exact-head Frontend CI + Frontend E2E gate on `84723eb593749bab0c3a33a3fb090539b2e3f315` and merged to `main` as `8133e36b09621bc58c8bf0180cf65fe34ab2c3c3`.

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
- Final exact head `84723eb593749bab0c3a33a3fb090539b2e3f315` passed Frontend CI run `36163606394` and Frontend E2E run `36163606469` (4/4).
- Final browser evidence artifact `10875624297` records the desktop/mobile checkpoint.
- PR #38 merged only after the exact tested head was verified and no review threads were open.

## Assessment Foundation Schema — TESTED / MERGED
PR #40 passed exact-head Database CI + Backend CI on `de36b145a49afc87953b9a3c8dbb0a6ace49c19b` and merged to `main` as `1484bca1a6d6a61ea231c3e10a1975df207b24f3`.

Implemented:
- stable Assessment identity and immutable assessment code.
- exact versioned definitions with normal/practice, normal/exam and mock classification.
- explicit canonical settings with seconds-based time limits and mock-only shape constraints.
- sections plus exact Question Bank `question_id + question_version` placements; no copied question payloads.
- learning placements separate from Definition and from Commerce entitlement.
- directed assignments with relational user/class audiences.
- public/barcode/live session foundation separate from Definition.
- attempt lifecycle with exact Assessment version, distribution-context integrity, attempt-number uniqueness and idempotency keys.
- autosave answer state with exact Question version/option foreign-key integrity and server-owned correctness fields.
- one final result per attempt with count constraints plus normalized section/skill summaries.
- intentional hot-path indexes for staff definitions, placements, attempts, answers and result summaries.
- reversible migration apply/verify/rollback/re-apply coverage.
- Assessment architecture/audit handoff in `docs/domains/assessment/ASSESSMENT_FOUNDATION_AUDIT.md`.

Verification:
- Database CI run `36164596402`: PASS apply + schema verification + rollback + re-apply.
- Backend CI run `36164596405`: PASS module lock + sqlc compile + gofmt + go vet + go test.

Still deliberately deferred:
- Assessment staff builder React UI and visual parity.
- staff builder React UI and visual parity.
- learner attempt start/autosave/resume/submit/scoring endpoints.
- directed scope authorization.
- result/review presentation.
- Learning mastery/review side effects.
- Realtime session orchestration.
- Commerce entitlement checks.
- legacy Mongo migration/backfill.

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

## Assessment Staff Builder React Cutover — TESTED / MERGED
Implemented:
- role-aware `/admin-dashboard/assessments` management route using the existing admin shell.
- bounded Assessment list/search/filter pagination and exact teacher path+subject gating before any list request.
- create/edit builder consuming canonical Assessment Definition/Version API.
- bounded server-side approved Question Bank search; no full inventory browser load.
- exact `questionId + questionVersion` placement preserved in the builder.
- workflow review controls and admin publication controls.
- responsive desktop/mobile layouts with Playwright screenshot evidence.

Verification:
- PR #43 implementation head `2fc2264b839ebb4e4d465c55a5f53fb469ba31a2` passed Frontend CI run `36190040514`.
- Frontend E2E run `36190040492` passed, including Assessment desktop, mobile and teacher exact-scope tests plus the existing suite.
- final exact head `d4e4de73336a9a55211ad4f28c8cada320b71eaa` passed Frontend CI run `36190174622` and Frontend E2E run `36190174557`.
- PR #43 merged to `main` as `3fd2c71ef95c92ae9ba40047637d2e410494c832`.

## Assessment Learner Attempt Core — TESTED / MERGED
Implemented:
- student-only start from approved + published + visible exact `published_version`.
- bounded idempotent start/submission keys and transactionally serialized attempt-number/max-attempt enforcement.
- exact-version learner-safe question/options projection with deterministic per-attempt randomization where configured.
- autosave/resume with ownership, exact placement/version validation and server-owned expiry.
- server-owned canonical scoring from Question Bank answer keys; points-weighted percentage plus question counts.
- one transactional final result per attempt and idempotent submission retry.
- learner React attempt experience with mobile checkpoint, autosave, navigation, progress and final result.
- transactional audit on start/submit without autosave audit amplification.
- deliberately excludes Realtime, Commerce, Learning side effects and AI.

Verification checkpoint:
- implementation head `eff0e6bef76edf015d234afd49a91365759277a2` passed Backend CI `36191084320`, Frontend CI `36191084520`, and Frontend E2E `36191084428`.
- final exact head `782d06a1d7b65435c2a8b68136aec17208a3d4de` passed Backend CI `36191285919`, Frontend CI `36191285944`, and Frontend E2E `36191285945`.
- PR #44 merged to `main` as `56d6d6edf661a44f8919efefcc8d60565da0a7b0`.

## Assessment Directed Assignments — TESTED / MERGED
Implemented:
- bounded staff assignment create/list/status management with relational student/class audiences.
- active school/class/student audience validation and staff school/assessment authority checks.
- assignment pins the exact published Assessment version; no copied question payloads.
- learner `mine` availability is bounded and requires an active direct-user or active class-membership audience.
- server-owned open/close windows, max-attempt overrides and assignment-context attempt counting.
- assignment attempt start is idempotent and records the assignment context transactionally with audit.
- public/barcode/live sessions, Commerce, Learning side effects and AI remain out of scope.

Verification checkpoint:
- exact implementation/test head `b801a97c9c5dbf6e4c88257acfc371cd70d7b1d0` passed Backend CI `36195573893`.
- final documentation-inclusive exact head `1680910ecf68a0f94f7f8a961ed678cecd49d718` passed Backend CI `36195683646`.
- PR #45 merged to `main` as `5eed0f62b9d1f732dae79ead422f4df3b1fdf90f`.

## Assessment Result / Review — TESTED / MERGED
PR #46 passed all required exact-head gates on `fb3f897b9a3c764d3784dbd49103ee65391082e6` and merged to `main` as `0fabf767557806d17012fb8456c3696698b97b0c`.

Implemented:
- learner-owned bounded result history (default 20, max 100, hasMore; no exact-count scan).
- learner-owned submitted-result detail.
- server-governed question review from the exact historical Assessment version.
- hard no-question projection when `allow_question_review=false`.
- correct answer omission when `show_answers=false`.
- explanation/hint/strategy omission when `show_explanations=false`.
- result-report presentation flag propagated to the learner UI.
- wrong/unanswered/marked-for-review projections without duplicating Question Bank rows.
- responsive result history/detail React routes.
- in-attempt “للمراجعة” control persists through autosave after an answer exists.
- exact Question Bank IDs/versions and Media references are reused; no question/image copies.
- Learning mastery, ReviewCard side effects, Realtime, Commerce and AI remain outside this batch.

Verification:
- Backend CI `36209979752`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36209979648`: PASS typecheck + production build.
- Frontend E2E `36209979850`: PASS, including disabled-review secrecy, hidden-answer policy and responsive review filters.
- browser evidence artifact `10894539327`.

Audit:
- `docs/domains/assessment/ASSESSMENT_RESULT_REVIEW_AUDIT.md`.

## Assessment Learning Placements — TESTED / MERGED
PR #47 passed all required exact-head gates on `e578d3a98d157b9143d713df4150ccd2f953c054` and merged to `main` as `3d45c6af4e5b03f5f2e136ae068f74c275f1cb93`.

Implemented:
- normalized staff create/list plus optimistic visibility/order updates over existing `assessment_learning_placements`.
- exact published Assessment-version pinning at placement creation.
- `training/tests/foundation/course` target-shape validation.
- Content-owned target validation through a narrow resolver interface; Assessment does not query foreign Content tables.
- bounded student-only availability requiring exact path + subject + slot and exact Course/Foundation context where relevant.
- placement-context attempt start with idempotency, per-placement max-attempt counting, exact-version scoring readiness and transactional audit.
- responsive staff placement management and learner `/assessments` entry UI.
- no copied Assessment, Question, Content or Media payload state.
- Commerce entitlement, Learning evidence/mastery and Realtime remain outside this slice.

Verification:
- Backend CI `36211820991`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36211821001`: PASS typecheck + production build.
- Frontend E2E `36211820983`: PASS staff placement lifecycle + mobile exact-scope learner start + existing browser suite.
- browser evidence artifact `10895858161`.
- initial gofmt and ambiguous Playwright-locator failures were corrected on the same PR without weakening behavior.

Audit:
- `docs/domains/assessment/ASSESSMENT_LEARNING_PLACEMENTS_AUDIT.md`.

## Assessment Public / Barcode / Live Sessions — TESTED / MERGED
PR #48 passed all required exact-head gates on `7574543efca3f577e0821280691146cfae9496d6` and merged to `main` as `c67f848b7495c240b9daf7b36f712c14940f89ef`.

Implemented:
- normalized staff Session distribution over canonical `assessment_sessions`, pinned to the exact published Assessment version.
- server-generated stable entry codes; Sessions start `scheduled` and require explicit CSRF-protected activation.
- server-owned active/open/close/cancel policy.
- bounded staff list (default 50, max 100, `hasMore`; no exact-count list scan).
- anonymous `public/barcode` attempts in dedicated normalized relational tables, with no Guest User fabrication and no account-result mixing.
- SHA-256 participant key storage, idempotent start/submission keys, per-participant attempt budget and server expiry.
- batched public answer insert with exact Assessment/Question-version foreign-key integrity and server-owned points-weighted scoring.
- optional bounded public `max_submissions`.
- authenticated Student `live` join/start reuses canonical `assessment_attempts.session_id`, per-session attempt budget and optional school/class membership gate.
- responsive staff Session manager, anonymous mobile Barcode/Public runner and authenticated mobile Live join flow into the canonical Attempt runner.
- Smart Classroom websocket/presence/reveal/projector orchestration remains Realtime-owned.
- Commerce entitlement and Learning mastery/evidence side effects remain outside this slice.

Migration:
- `000021_assessment_session_distribution`.

Verification:
- Database CI `36213579205`: PASS apply + schema verification + rollback + re-apply.
- Backend CI `36213579357`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36213579167`: PASS typecheck + production build.
- Frontend E2E `36213579219`: PASS staff Session create/activate + anonymous mobile barcode submission + authenticated mobile live join/start + existing browser suite.
- browser evidence artifact `10896393424`.
- initial first-pass Backend failure was gofmt-only and was corrected on the same PR without weakening behavior.

Audit:
- `docs/domains/assessment/ASSESSMENT_SESSION_DISTRIBUTION_AUDIT.md`.

## Assessment phase checkpoint
Assessment HTTP/product-entry core is now closed through:
- versioned Definition + staff builder.
- learner Attempt/autosave/submit/result/review.
- directed Assignments.
- Learning Placements.
- Public/Barcode/Live Session distribution.

Not claimed by this checkpoint:
- Smart Classroom realtime orchestration.
- Learning mastery/adaptive/review-card side effects.
- Commerce entitlement decisions.
- Reporting/analytics beyond Assessment core result/review projections.

## Learning Evidence / Mastery / Review Foundation — TESTED / MERGED
PR #49 passed all required exact-head gates on `9a7f0c6d3f3f2c0af835e29ea750ddd9f403d864` and merged to `main` as `61e67ef145179832d57a1de19b8652d9d086c7e4`.

Implemented:
- migration `000022_learning_evidence_review` with normalized evidence, skill progress, ReviewCard and card-skill relations.
- one canonical Assessment evidence event per submitted attempt/question outcome with a DB replay guard.
- retry-safe Assessment submit → Learning handoff: failed Learning application can be retried through the same Assessment submission key without duplicating result/evidence.
- exact path/subject + multi-skill evidence scope.
- deterministic mastery/status/recommended-action bands preserving the documented legacy policy.
- canonical one learner/question ReviewCard with independent saved + mistake reasons and SM-2 scheduling state.
- bounded student-only review library (default 20, max 50; no exact-count scan).
- bounded student-only mastery progress (default 50, max 100) and weakest-skill next action.
- batched exact-version Question Bank review projection; no per-card Question N+1.
- responsive `/review` React surface and save-from-result workflow.
- anonymous Public/Barcode results remain outside account mastery until an explicit identity-claim product flow exists.
- Realtime, Commerce, AI and reporting aggregates remain outside this batch.

Verification:
- Database CI `36215808450`: PASS.
- Backend CI `36215808456`: PASS.
- Frontend CI `36215808437`: PASS.
- Frontend E2E `36215808444`: PASS, including save-from-result and mobile review/mastery flows.
- browser evidence artifact `10897855638`.
- earlier Database/Backend/E2E failures were fixed on the same PR before the final exact-head run without weakening tests.

Audit:
- `docs/domains/learning/LEARNING_EVIDENCE_REVIEW_FOUNDATION_AUDIT.md`.

## Learning Remediation / Mastery Review Loop — TESTED / MERGED
PR #50 passed all required exact-head gates on `fb9025418145620105c43caf4903f114dfdafd8e` and merged to `main` as `e9895e78ecd21c956fbdc97be23c4c9a9e78cfe8`.

Implemented:
- migration `000023_learning_review_loop` with idempotent `review_answer_submissions` and explicit Learning evidence source linkage.
- Assessment evidence remains linked to Assessment attempts; remediation/mastery-review evidence links to Review submissions without fabricating an Assessment attempt.
- bounded due-card discovery by exact learner/path and optional subject/tab (default 20, max 50; no exact-count scan).
- due practice projection composes canonical Question ID/version in one Question Bank batch and strips answer key/explanation/hint/strategy before answer.
- CSRF-protected server-scored answer submission using canonical Question Bank answer key.
- idempotency by learner + bounded submission key and optimistic `expectedUpdatedAt` ReviewCard concurrency.
- deterministic remediation vs mastery-review evidence classification from the pre-answer ReviewCard state.
- ReviewCard SM-2 advancement after each submitted answer, with historical mistake reason retained independently.
- mastery progress recomputation counts both Assessment attempts and Review submissions without double-counting replay.
- responsive `/review/practice` one-question-at-a-time loop and entry from the existing Review library.
- Assessment results/attempt ownership, Realtime, Commerce and AI remain outside this Learning slice.

Verification:
- Database CI `36223291223`: PASS apply + schema verification + rollback + re-apply.
- Backend CI `36223291194`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36223291218`: PASS typecheck + production build.
- Frontend E2E `36223291202`: PASS mobile due-review flow, no pre-answer key leakage, CSRF server scoring, post-answer feedback and next-review schedule.
- browser evidence artifact `10900230059`.
- initial Backend failure was gofmt-only and was corrected on the same PR without weakening tests.

Audit:
- `docs/domains/learning/LEARNING_REMEDIATION_LOOP_AUDIT.md`.

## Learning Lesson / Video Progress — TESTED / MERGED
PR #51 passed all required exact-head gates on `78f26cf1aff797fec0a3cd8dc827f04c1f4626e2` and merged to `main` as `125094a5f6e2af95aa0433c461fc96486133b6fc`.

Implemented:
- migration `000024_learning_lesson_video_progress` with context-isolated normalized Lesson and video resume state.
- one learner + reusable Lesson + exact Course/Foundation context progress row; no unbounded completion/video arrays on the user.
- student-only CSRF-protected progress API.
- Content-owned learner-safe context validation through a narrow resolver boundary; Learning does not query foreign Content tables.
- lazy learner Course Lesson detail instead of hydrating video URLs for every Lesson in a Course.
- direct-upload HTML5 video resume with coarse persistence and explicit server-confirmed completion.
- locked non-preview Course Lessons and locked Foundation Lessons fail closed.
- seek/resume position never auto-completes a Lesson.
- completed state remains separate from video position.
- responsive `/learning/courses/{courseId}` surface and mobile browser proof.
- no interactive-video question schema was invented before Content owns that contract.
- YouTube/Vimeo provider-SDK resume and interactive must-pass event migration remain deliberate follow-up work.
- Commerce entitlement remains outside Learning.

Verification:
- Database CI `36225203823`: PASS apply + schema verification + rollback + re-apply.
- Backend CI `36225203857`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36225203909`: PASS typecheck + production build.
- Frontend E2E `36225203838`: PASS mobile resume persistence, explicit-completion integrity, locked-Lesson no-request behavior and existing browser suite.
- browser evidence artifact `10900855682`.
- initial gofmt and ambiguous E2E-locator failures were corrected on the same PR without weakening behavior.

Audit:
- `docs/domains/learning/LEARNING_LESSON_VIDEO_PROGRESS_AUDIT.md`.

## Learning Mastery Goals — TESTED / MERGED
PR #52 passed all required exact-head gates on `25c95ce69276f501b0d06934fb85b513420d5fbc` and merged to `main` as `1d77971252e2b5aa98fad5321b77436cf516c473`.

Implemented:
- migration `000025_learning_mastery_goals` with normalized learner/path/subject ownership, bounded indexes and no user-embedded arrays.
- student-only bounded list (default 20, max 100, `hasMore`; no exact-count scan).
- CSRF-protected create/update with optimistic `expectedUpdatedAt`.
- Taxonomy-owned active path/optional-subject validation through a narrow boundary.
- verified legacy defaults: 90% target mastery, short/long horizons, 14/60-day quick due dates.
- responsive goals panel integrated into `/review`, with one active short and one active long goal in the current UI scope plus achieve/archive controls.
- goals remain tracking markers and do not mutate mastery evidence/progress.
- verified canonical path targets are supported now.
- legacy `section/topic` targets fail closed because V2 has no canonical legacy Section mapping and no safe Topic mapping has been assigned to Taxonomy.
- staff-targeted learner goals remain deferred to school Interventions where Organizations authority can be composed correctly.
- Study Plans, school Interventions, Commerce, Realtime and AI remain outside this batch.

Verification:
- Database CI `36227064502`: PASS apply + schema verification + rollback + re-apply.
- Backend CI `36227064489`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36227064477`: PASS typecheck + production build.
- Frontend E2E `36227064470`: PASS mobile self-owned goal create, optional path-only → exact subject scope transition, CSRF POST, optimistic achieve PATCH and existing browser suite.
- browser evidence artifact `10901058035`.
- initial gofmt and Playwright mock-scope/routing failures were corrected on the same PR without weakening behavior.

Audit:
- `docs/domains/learning/LEARNING_MASTERY_GOALS_AUDIT.md`.

## Learning Study Plans — TESTED / MERGED
PR #53 passed all required exact-head gates on `f7334dfbb3a0513cacf694082eaa3a2e2d924dce` and merged to `main` as `22eaaab106be64dce2e33d4e194263f1dbc0d93b`.

Implemented:
- normalized self-owned `study_plans` plus subject/course/off-day relations and relational `study_plan_items`.
- legacy-evidenced plan settings preserved: name, path, optional subjects/courses, date range, skip-completed assessments, off-days, daily minutes, preferred start time, active/archive and delete.
- deterministic server-side schedule generation with bounded candidate catalogs, daily minute budget, off-day exclusion and foundation/practice/review phases.
- Study Plan items reference canonical Content Lessons/Library items and Assessment learning placements; no Lesson/Question/Assessment payload copies.
- Taxonomy validates active path/subject scope through a narrow boundary.
- Content validates selected Courses and provides bounded learner-safe Lesson/Library candidates through a narrow boundary.
- Assessment provides bounded published placement candidates and completion/attempt-budget projection through a narrow boundary.
- existing Learning Lesson progress is reused for completion without embedded completion arrays.
- student-only CSRF-protected create/update/delete, optimistic `expectedUpdatedAt` updates and bounded list.
- responsive `/plan` flow with lazy exact-subject Course discovery and today/week/all schedule views.
- normal list hydrates only the first selected plan detail instead of issuing detail reads for every listed plan.
- staff-created intervention plans remain deliberately outside this batch; Organizations authority is reserved for the separate Interventions slice.

Verification:
- Database CI `36230733615`: PASS apply + schema verification + rollback + re-apply.
- Backend CI `36230733610`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36230733660`: PASS typecheck + production build.
- Frontend E2E `36230733696`: PASS mobile create, lazy exact-subject Course discovery, deterministic schedule rendering, one-detail hydration and optimistic CSRF archive plus existing browser suite.
- browser evidence artifact `10901838282`.
- initial gofmt and ambiguous Playwright selector failures were corrected on the same PR without weakening behavior.

Audit:
- `docs/domains/learning/LEARNING_STUDY_PLANS_AUDIT.md`.

## Learning School Interventions — TESTED / MERGED
PR #54 passed all required exact-head gates on `4ac47b749c03259632e697dc34fa34503ebfd9cb` and merged to `main` as `b9e3d76ec39d41963355516207f02345e53c069d`.

Implemented:
- normalized `school_interventions` with exact school/class/student/path/subject/skill relationships, linked Study Plan, lifecycle, baseline and outcome snapshots.
- verified legacy intervention semantics: one school student + skill, `study_plan` action, 14-day generated plan, follow-up, remediation threshold, minimum evidence and outcome measurement.
- Learning owns intervention state; Organizations owns school/class/student/staff authority; Taxonomy owns exact skill scope.
- school-admin management requires `SCHOOL_INTERVENTIONS_MANAGE`; view accepts VIEW/MANAGE; supervisor authority follows exact active school/class scopes.
- no staff intervention list request is sent before exact class selection; class-scoped supervisors cannot issue broad school reads.
- create validates active student class membership and exact canonical skill before generating any plan.
- intervention Study Plan and intervention row are created transactionally; active intervention plans remain learner-readable but cannot be edited/deleted through self-owned Study Plan mutations.
- baseline and outcome use canonical Learning evidence for the exact student/path/subject/skill.
- outcome remains insufficient until the configured minimum new evidence exists; delta/threshold comparison is server-owned.
- bounded staff list (default 50/max 100) and learner list (default 20/max 50), both `limit+1/hasMore`; no exact-count Learning scan added.
- CSRF-protected create/update/measure with optimistic `expectedUpdatedAt` and transaction-scoped Operations audit.
- responsive school director/supervisor intervention UI using canonical school contexts/classes/roster + Taxonomy.
- learner `/plan` shows active school intervention context alongside the generated Study Plan.

Verification:
- Database CI `36234761401`: PASS apply + schema verification + rollback + re-apply.
- Backend CI `36234761307`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36234761304`: PASS typecheck + production build.
- Frontend E2E `36234761314`: PASS director create/measure/complete, exact-class supervisor read, mobile learner intervention visibility and existing browser suite.
- browser evidence artifact `10903569202`.
- initial Backend failure was gofmt-only and was corrected on the same PR; all gates were rerun on the final head.

Audit:
- `docs/domains/learning/LEARNING_SCHOOL_INTERVENTIONS_AUDIT.md`.

## Commerce Entitlement Foundation — TESTED / MERGED
PR #55 passed all required exact-head gates on `186aab81e0df34cadad18b1d2c52df2e1384f0f9` and merged to `main` as `d0daabcadcdfc8bdd7768d2691641b62becde174`.

Implemented:
- normalized `commerce_products`, `commerce_packages`, relational `commerce_package_items`, and canonical `commerce_entitlements`.
- integer minor-unit pricing + currency; Content remains price-agnostic.
- verified Course-vs-Package split and legacy content-type scopes.
- existing V2 Courses backfilled as explicit free Course products to preserve current learner behavior during staged cutover.
- new/unconfigured Courses fail closed for non-preview delivery.
- Course products validate canonical approved/published/visible Content through a narrow boundary.
- package Path/Subject targets validate through Taxonomy; Commerce stores IDs only.
- active School membership is composed through Organizations rather than Commerce cross-domain membership SQL.
- school entitlement inheritance is allowed only for unlimited packages; seat-capped packages require future explicit per-user seat/grant flow.
- platform-admin bounded product/entitlement management with CSRF, optimistic updates/revokes, idempotent manual grant and transaction-scoped audit.
- Course learner structure carries a separate Commerce access decision; non-preview Lesson detail is server-enforced.
- responsive Commerce admin UI and learner preview/paid lock behavior.
- PaymentRequest, discounts, provider secrets/webhooks, access-code redemption, revenue payouts and Assessment entitlement consumption remain deliberately outside this foundation slice.

Verification:
- Database CI `36236809132`: PASS apply + schema verification + rollback + re-apply.
- Backend CI `36236809185`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36236809255`: PASS typecheck + production build.
- Frontend E2E `36236809141`: PASS Commerce admin/access behavior plus existing browser suite.
- browser evidence artifact `10903659884`.
- initial Backend failure was gofmt-only and was corrected on the same PR; all four gates were rerun on the final head.

Audit:
- `docs/domains/commerce/COMMERCE_ENTITLEMENT_FOUNDATION_AUDIT.md`.

## Commerce Checkout / Discount / Provider Ledger — TESTED / MERGED
PR #56 passed all required exact-head gates on `e399083d20755e2a208cc042fa072fbe858b83f6` and merged to `main` as `a59fdad11f7a95849d2dcb43b53428366e3cc4c9`.

Implemented:
- migration `000029_commerce_checkout_ledger` with normalized discount codes/scopes, reserved/redeemed discount ledger, PaymentRequest snapshots and provider-event ledger.
- Checkout accepts only Product ID, optional discount code, payment method and bounded idempotency key; Product revision/name/price/currency/scope are derived server-side.
- transactional discount reservation with exact lifecycle/scope/minimum/redemption-budget validation and atomic redeem/release.
- manual platform-admin paid approval requires evidence and grants one idempotent Entitlement inside the payment transaction.
- raw-body HMAC-SHA256 webhook verification, fail-closed missing secret, provider+eventId dedupe, payload SHA-256 evidence and exact provider/mode/final amount/currency checks before grant.
- verified semantic webhook rejections remain in the provider-event ledger.
- responsive learner Checkout, paid-Course purchase entry, recent requests, admin discount controls and pending-payment review.
- browser E2E proves no authoritative price/amount/currency/product name is sent by Checkout.
- Access-code redemption, explicit school seat assignment, trainer payouts and Assessment entitlement consumption remain outside this slice.

Configuration:
- `COMMERCE_PAYMENT_GATEWAY_MODE=manual_review|webhook`.
- `COMMERCE_PAYMENT_PROVIDER_CODE=<provider>`.
- `PAYMENT_WEBHOOK_SECRET=<server-only secret>`; no browser exposure.

Verification:
- Database CI `36240504567`: PASS apply + schema verification + rollback + re-apply.
- Backend CI `36240504510`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36240504504`: PASS typecheck + production build.
- Frontend E2E `36240504506`: PASS server-authoritative learner Checkout + no-client-price payload contract + admin discount/payment review + existing browser suite.
- browser evidence artifact `10905419021`.
- initial gofmt, type-projection and ambiguous/localized Playwright failures were fixed on the same PR; all four gates were rerun on the final head.

Audit:
- `docs/domains/commerce/COMMERCE_CHECKOUT_LEDGER_AUDIT.md`.

## Commerce Access Codes / Explicit School Seats — TESTED / MERGED
PR #57 passed all required exact-head gates on `4dead20ea2f6480d3c854a52176462987ed0cdf7` and merged to `main` as `386023ebbfd73613df65727ead7491c146f9d2ff`.

Implemented:
- migration `000030_commerce_access_codes_seats` with normalized activation-code redemption and explicit school-seat ledgers.
- access codes reference canonical paid Package/Membership products; package scope is not copied into code records.
- server-normalized code redemption with lifecycle, expiry, max-use and per-user idempotency.
- school-scoped code redemption requires an existing active Organizations membership; Commerce never creates or mutates school membership.
- code and Package rows are transaction-locked before capacity evaluation so multiple activation codes cannot race past the same package seat cap.
- capped school Packages do not inherit access through broad school membership; an explicit seat creates one user Entitlement.
- explicit seat assignment requires an active school Entitlement and active target-user school membership through the Organizations projection.
- seat assignment is capacity-bounded and idempotent; seat revoke atomically revokes its generated user Entitlement.
- unlimited school Packages retain the existing school-level inheritance behavior.
- learner Checkout supports activation-code redemption while keeping discount/payment authority server-side.
- Commerce admin supports access-code lifecycle and explicit school-seat assign/revoke workflows.

Verification:
- Database CI `36243759206`: PASS apply + schema verification + rollback + re-apply.
- Backend CI `36243759164`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36243759193`: PASS typecheck + production build.
- Frontend E2E `36243759203`: PASS learner activation-code redemption + existing trusted Checkout/admin and Commerce foundation flows.
- browser evidence artifact `10906349191`.
- first E2E failure was a stale Commerce foundation mock for the newly added access-code directory; it was corrected without weakening behavior and all four gates passed on the final head.

Audit:
- `docs/domains/commerce/COMMERCE_ACCESS_CODES_SEATS_AUDIT.md`.

## Commerce / Assessment Entitlement Consumption — TESTED / MERGED
PR #59 passed all required exact-head gates on `350cf298e3112ac122bf919571291c87e37fba17` and merged to `main` as `26a4269255674fac6d942333a3664361da6d94ca`.

Implemented:
- migration `000031_assessment_commerce_access` adds Version base access `free|paid|private|course_only` and Placement override `inherit|free|paid|package`, preserving existing migrated behavior through `free + inherit` defaults.
- Assessment owns access policy while Commerce remains canonical Entitlement authority; Assessment does not read Commerce tables directly.
- direct paid Assessment start resolves current Commerce Entitlements; private and course-only direct starts fail closed outside authorized distribution context.
- learner placement availability returns server-owned `accessAllowed/accessReason` and folds Commerce access into `canStart`.
- placement start rechecks Commerce immediately before creating a new Attempt.
- retry/idempotency semantics are preserved: an existing Attempt for the same start key is resumed before a new entitlement denial can invalidate the retry.
- package scopes compose canonical all/course/path/subject/content-type targets; normal Assessment uses `tests`, mock uses `mock_exams`.
- capped school packages consume the explicit user Entitlement created by the school-seat flow; unlimited school packages may use eligible school Entitlements.
- package-only placement policy does not accept a standalone Course-product entitlement.
- Study Plan/adaptive candidate discovery passes through the same effective Assessment access resolver before new plans are generated.
- public/barcode/live Session and directed Assignment remain their existing authorized special/audience distribution paths rather than being silently converted into purchase checks.
- Assessment builder and placement management expose the access policies; learner availability renders Commerce-locked state separately from exhausted attempts.

Verification:
- Database CI `36245483437`: PASS apply + schema verification + rollback + re-apply.
- Backend CI `36245483438`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36245483452`: PASS typecheck + production build.
- Frontend E2E `36245483523`: PASS Assessment access/browser flows including locked paid placement.
- browser evidence artifact `10906983993`.

Audit:
- `docs/domains/commerce/COMMERCE_ASSESSMENT_ACCESS_AUDIT.md`.

## Commerce Actual Revenue / Trainer Payout Ledger — TESTED / MERGED
PR #60 passed all required exact-head gates on `8ed34950b19594bc07b7d02db05cd8fff353ac05` and merged to `main` as `c2e3555215ee17d6b193d12d270ff518169a9398`.

Implemented:
- migration `000032_commerce_revenue_payout_ledger` adds PaymentRequest trainer-policy snapshots and normalized `commerce_revenue_entries`.
- Content remains owner of Course ownership + admin-controlled revenue-share policy; Commerce snapshots the policy through a narrow boundary at Checkout creation and never joins Content tables directly.
- only teacher-owned Courses receive a trainer beneficiary; assigned teachers on platform-owned Courses are not silently treated as revenue owners.
- a teacher-owned Course with no configured percentage is explicitly `policy_missing`; no payout amount is invented.
- revenue rows are created only from trusted paid PaymentRequest transitions: evidence-backed manual approval or verified paid webhook with canonical amount/currency matching.
- revenue creation is idempotent per PaymentRequest and stores server-authoritative gross, discount, paid amount and currency facts.
- no historical backfill applies today's policy to old sales.
- no provider fee/trainer share/platform share is automatically estimated because the source material does not define the financial formula.
- platform-admin factual allocation requires explicit evidence, optimistic revision and exact integer-minor-unit identity: provider fee + trainer share + platform share = paid amount.
- positive trainer share can be marked paid only after allocation with payout evidence; zero share is not treated as a pending payout.
- allocation/payout mutations lock the row, enforce revision and write Operations audit events.
- responsive Commerce admin shows factual revenue/allocation/payout status and states that settlement numbers are not estimates.
- Package/Membership multi-trainer allocation remains deferred until an explicit business rule exists.

Verification:
- Database CI `36251701308`: PASS apply + schema verification + rollback + re-apply.
- Backend CI `36251701292`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36251701283`: PASS typecheck + production build.
- Frontend E2E `36251701284`: PASS all 30 browser tests including factual revenue allocation + trainer payout evidence.
- browser evidence artifact `10910000402`, digest `sha256:7023d14206c488693fbc91659f095dbe16c48d034da1f9d94bacf70704d5b900`.
- initial Backend failure was gofmt-only; initial E2E failure was an ambiguous locator after successful allocation. Both were fixed without weakening behavior and all four gates reran green on the final head.

Audit:
- `docs/domains/commerce/COMMERCE_REVENUE_PAYOUT_AUDIT.md`.

## Commerce Tap Hosted Payment Link — TESTED / MERGED
PR #61 passed all required exact-head gates on `8928c20bffcb293c931c599430cb92b9bd9bff56` and merged to `main` as `a26586c4bf89cdfa37dd7dd0b26306f4e2533f1a`.

Implemented:
- migration `000033_commerce_tap_payment_session` extends PaymentRequest with hosted-provider session state and the explicit `payment_link` gateway mode.
- Checkout remains server-authoritative: browser submits Product ID, optional discount, payment method and idempotency key only; trusted amount/currency/product context comes from Commerce.
- provider-specific Tap adapter creates the hosted Charge from the canonical PaymentRequest and correlates transaction/order/idempotent references to PaymentRequest ID.
- Tap charge/session ID and redirect URL are persisted only after a valid initiated provider response.
- failed provider initiation fails closed and releases any reserved discount instead of leaving an unusable reservation.
- payment-link flow is currently card-only; unsupported local payment methods are rejected before PaymentRequest/discount reservation creation.
- browser receives the trusted hosted-payment redirect URL only; no Tap secret or authoritative amount is exposed client-side.
- Tap-specific webhook reads raw payload, verifies the provider hashstring using the server-only Tap key and maps final charge state into the existing provider-event ledger.
- exact provider, amount and currency checks remain authoritative before Entitlement grant; duplicate provider events remain idempotent.
- a trusted paid Tap callback still flows through the same Entitlement and factual-revenue ledger built in earlier Commerce slices.
- Tap configuration is environment-owned: `COMMERCE_PAYMENT_GATEWAY_MODE=payment_link`, `COMMERCE_PAYMENT_PROVIDER_CODE=tap`, `TAP_SECRET_KEY` (legacy fallback `TAP_API_KEY`), `TAP_WEBHOOK_URL`, and optional `TAP_REDIRECT_URL`.
- live Tap sandbox transaction is not claimed as proven because external account credentials are required; this is an environment/external-proof dependency, not a code merge gate.

Verification:
- Database CI `36252943842`: PASS apply + schema verification + rollback + re-apply.
- Backend CI `36252943838`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36252943811`: PASS typecheck + production build.
- Frontend E2E `36252943750`: PASS trusted Tap hosted redirect with no browser amount authority plus existing browser suite.
- browser evidence artifact `10909912571`, digest `sha256:a853919f1f7d6af2b8e0205f4eab869c1ec840da942669c156fa0103f1f2e3e6`.
- initial Backend runs exposed invalid escaped struct tags and gofmt deltas; they were corrected without weakening behavior, then all four exact-head gates passed.

Audit:
- `docs/domains/commerce/COMMERCE_TAP_PAYMENT_LINK_AUDIT.md`.

## Commerce Full Payment Reversals — TESTED / MERGED
PR #62 passed all required exact-head gates on `694bd1af2b2f7a317b13dffe57ca4661b1fc63ec` and merged to `main` as `88bbd386cf291e557dbc0729168ec18f3e065f38`.

Implemented:
- migration `000034_commerce_payment_reversals` adds normalized one-per-PaymentRequest full `refund|chargeback` facts plus explicit revenue-reversal projection.
- PaymentRequest keeps the original paid timestamp and transitions from `paid` to `refunded` or `chargeback`.
- full reversal requires exact server-authoritative paid amount, currency and provider; partial refunds are deliberately rejected because access/revenue semantics are not source-defined.
- verified provider reversals reuse the provider-event idempotency/evidence ledger; generic signed events support full refunded/chargeback state.
- Tap Refund webhook verification accepts only finalized `REFUNDED`, verifies the provider hashstring and correlates through original payment reference or the uniquely persisted provider session/charge ID.
- provider + provider-session correlation is now protected by a partial unique database index.
- platform-admin reconciliation can record an externally completed full refund/chargeback only with CSRF, exact optimistic revision, provider reference and evidence; it does not initiate provider-side money movement.
- active Entitlements sourced from that PaymentRequest are revoked atomically with the reversal.
- factual revenue keeps original gross/discount/paid/allocation/payout history and adds explicit reversal type, full reversed amount, reference and timestamp.
- once reversed, new revenue allocation or trainer-payout marking is blocked. A payout already recorded as paid remains a historical fact; no automatic trainer clawback is invented.
- redeemed discount capacity is not restored because refund coupon semantics are not defined by the source material.
- Commerce admin separates pending reviews from paid/reversed sales, supports evidence-backed full reversal recording and displays the revenue reversal without presenting it as an estimated adjustment.

Verification:
- Database CI `36254502426`: PASS apply + reversal/provider-session schema verification + rollback + re-apply.
- Backend CI `36254502476`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36254502436`: PASS typecheck + production build.
- Frontend E2E `36254502532`: PASS factual full refund reversal, revenue reversal visibility, disabled post-reversal payout and existing browser suite.
- browser evidence artifact `10909024739`, digest `sha256:ce44008cba452717c65f09eef8118ae9e79fb624417495c365fbe19e339e84c4`.
- early runs caught gofmt, frontend projection and Go constant-domain issues; all were fixed without weakening behavior. The final head also includes unique provider-session correlation hardening before the complete exact-head rerun.

Audit:
- `docs/domains/commerce/COMMERCE_PAYMENT_REVERSALS_AUDIT.md`.

## Phase 8 Commerce checkpoint
The implemented Commerce path now covers canonical products/packages/entitlements, server-authoritative Checkout and discounts, provider-event evidence, activation codes and capped school seats, Assessment entitlement consumption, factual Course revenue/trainer payout evidence, Tap hosted payment-link initiation/webhook handling, and factual full payment reversals.

Commerce remains `TESTED`, not `PARITY_PROVEN`. The remaining Commerce items cannot be safely completed by inference:
- live Tap sandbox proof requires external account credentials/configuration.
- partial-refund access/revenue effects, provider-fee recovery and trainer payout clawback require explicit business policy/provider contracts.
- Package/Membership multi-trainer allocation requires an explicit allocation rule.
These items stay explicit external/UNKNOWN boundaries rather than being implemented speculatively.

## Parents Linked-Child Dashboard / Weekly Report — TESTED / MERGED
PR #63 passed all required exact-head gates on `cfcc0bf24caa55c52266fcc75c5c0dc31f4c0a95` and merged to `main` as `0fc4d5d4962e01ca81c844eb153a8c0235103260`.

Implemented:
- Organizations remains canonical owner of active `parent_student_relationships`; Parents consumes that authority instead of storing duplicate child arrays or inferring scope from Identity.
- `GET /api/v1/parents/authority` remains available through the new Parents facade.
- Parent dashboard orchestration sends only already-authorized bounded student IDs to owning-domain readers.
- Identity supplies a privacy-safe name/avatar projection only; parent reads do not expose email, phone or national ID.
- Assessment supplies batched rolling-seven-day count/average/time facts plus bounded recent result summaries; question responses, correct-option keys and review payloads never enter the parent contract.
- Learning supplies batched current skills below the canonical good threshold plus its existing deterministic `recommended_action`; Parents does not invent a second recommendation engine.
- `GET /api/v1/parents/dashboard` returns bounded linked-child overview data.
- `GET /api/v1/parents/children/{studentId}/results` rechecks canonical authority before calling Assessment; an unlinked student is denied before the foreign reader executes.
- `GET /api/v1/parents/weekly-report` returns a read-only rolling seven-day summary and does not send email/WhatsApp.
- `/parent-dashboard` is no longer a placeholder: responsive overview, linked children, results, weak skills/next action, weekly report and explicit no-linked-child state are implemented.
- no self-service link-code/consent policy, parent payment approval, notification delivery, WhatsApp preference or student learning mutation was invented where the Blueprint did not make it part of this golden slice.

Verification:
- Database CI `36261272111`: PASS apply + canonical parent relationship index verification + rollback + re-apply.
- Backend CI `36261272140`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36261272127`: PASS typecheck + production build.
- Frontend E2E `36261272112`: PASS all 34 browser tests including mobile parent linked-child golden journey and no-active-link empty state.
- browser evidence artifact `10912034166`, digest `sha256:55ae07b373810ef3e3a04fce7e18cc94b90d16c484b61dee8d81806b57b4e127`.
- early Backend failures were formatting-only. The first Parent E2E failure was a strict-locator ambiguity and was corrected by targeting the semantic linked-child heading without changing product behavior.

Audit:
- `docs/domains/parents/PARENTS_DASHBOARD_REPORT_AUDIT.md`.

## Parents phase checkpoint
The Product Blueprint parent golden journey is now implemented and exact-head tested: **active linked child only -> result/progress -> weekly report**. Parent is an observer and cannot author Assessment or mutate Learning state.

Parents remains `TESTED`, not `PARITY_PROVEN`. Parent-specific notification delivery, weekly scheduling, email/WhatsApp preferences/templates and delivery evidence belong to the Communication/Notifications phase. Legacy payment-approval and self-linking behaviors are not treated as canonical unless a source-backed product rule is established.

## Next exact action
Start the Communication/Notifications phase from current `main`. Re-read the Blueprint, current notification placeholders/legacy delivery flows and provider/config evidence before choosing the first bounded slice. Keep domain events and outbox/delivery evidence separate from parent/assessment state, make user notification preferences explicit, and do not invent WhatsApp/email retry, consent or provider semantics where source evidence is missing.
