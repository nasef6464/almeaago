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

## Next exact action
Phase 7 core Learning/Adaptive/Review slices are now tested/merged. Start Phase 8 Commerce/Entitlements from current `main` with a legacy contract audit before schema work: identify canonical package/product/price/entitlement ownership, free-vs-paid access rules for Content and Assessment, school/package boundaries, subscription lifecycle and payment-provider boundaries. Then create only the normalized PostgreSQL Commerce foundation needed for server-owned entitlement checks; do not mix payment-provider secrets/state into Content, Assessment or Learning and do not add broad access queries.