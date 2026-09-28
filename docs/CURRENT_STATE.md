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

Owner-domain follow-through completed after this slice:
- Content now owns canonical trainer path/subject scopes.
- Reporting/Identity directory composition supports the platformTrainer filter/count from canonical Content scope.

External parity evidence still pending:
- live Google/WhatsApp staging smoke with deployment credentials.
- direct legacy-runtime desktop/mobile screenshot capture for side-by-side comparison; the new V2 Auth screenshots are now captured by CI.

## Identity Closure Audit
See `docs/domains/identity/IDENTITY_CLOSURE_AUDIT.md`.

Routes deliberately owned elsewhere:
- preferences -> Learning.
- purchase/redeem -> Commerce.
- parent-facing link/unlink/read flows -> Parents / Organizations.
- trainer directory/performance -> Reporting / Content ownership.
- school/class/group canonical relationship state -> Organizations.

## Identity/Auth integrated parity certification — TESTED
PR #69 certified the current integrated Identity/Auth slice without converting external-provider evidence into a fake pass, and was squash-merged to `main` as `274361cc4141567cab51686c246778a1b4e5b0e2`.

Internal evidence now includes:
- desktop email login modal and failure state.
- mobile signup and password-policy UI.
- Saudi-phone WhatsApp OTP send/verify progression against a mocked provider boundary.
- forgot/reset/email-verification journeys, including token-from-URL and manual-token flows.
- deterministic browser screenshots for the Auth states above.
- backend coverage for the documented 160-character password ceiling.
- Database CI assertions for Identity security tables, constraints and hot indexes.

Final documentation-inclusive head `54850ff87947600b2d5b8e9576fc52da02e32622` passed all four gates:
- Database CI `36308990772`.
- Backend CI `36308990784`.
- Frontend CI `36308990806`.
- Frontend E2E `36308990810`: complete browser suite including the five Auth parity journeys.
- browser evidence artifact `10928029227`, digest `sha256:7dc5638eec7ec7051b08b49d6c7050a646537f506af0b035a865ae84c3a09fa3`.

Release boundary:
- Identity is now `TESTED` internally, not `PARITY_PROVEN`.
- live Google OAuth, live WhatsApp delivery and direct legacy-runtime screenshot comparison remain external staging/visual evidence.
- PR #69 is merged; the next parity batch starts only from current `main`.

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

Commercial school contracts/modules/entitlements are not moved into Organizations. Contract module truth is projected read-only where the school workspace needs to evaluate delegated capabilities; other entitlement/access state remains with its owner domains.

## Organizations / Schools / Classes integrated parity certification — TESTED
PR #70 closed the current repository-internal Organizations parity batch and was squash-merged to `main` as `b7a9ae7a7844e187efec714fcec43b382a6ffa2f`.

Implemented/verified in this batch:
- `/school-director-dashboard` is a real responsive school-admin workspace instead of a placeholder.
- only active `school_admin` school contexts enter the director selector.
- the no-delegated-school state is explicit.
- bounded student search/list, add, idempotent same-school class move, basic edit and reversible activate/deactivate flows are wired to the existing server-authoritative APIs.
- class create/rename and teacher assignment are exposed only for the exact delegated school.
- no student hard-delete operation is exposed.
- active valid school-contract modules are projected into canonical school context.
- `SCHOOL_STUDENTS_UPDATE_BASIC`, `SCHOOL_STUDENTS_DEACTIVATE`, `SCHOOL_CLASSES_MANAGE` and `SCHOOL_TEACHERS_ASSIGN` require the explicit permission plus active `SCHOOL_CORE` when resolved through Organizations permission authority.
- the UI uses the same permission + module pairing before rendering those optional tools.
- Reporting, Assessment, Realtime and Learning operations remain in their owner domains and are not copied into Organizations.

Final documentation-inclusive head `bfe1cdab22d476080706e0a7ce5884590b05ecda` passed all four gates:
- Database CI `36311953531`.
- Backend CI `36311953495`.
- Frontend CI `36311953492`.
- Frontend E2E `36311953491`: 54/54 tests.
- browser evidence artifact `10929288587`, digest `sha256:9b4b24e6ace8a78a5e8495907fc937d88ff8c5a683abd3292bc6639c9bfc1fca`.

Release boundary:
- Organizations remains `TESTED`, not `PARITY_PROVEN`.
- deterministic V2 desktop/mobile director screenshots now exist, but direct legacy-runtime side-by-side visual comparison remains external evidence.
- PR #70 is merged; the next parity batch starts only from current `main`.

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

## Taxonomy integrated parity certification — TESTED
PR #71 closed the current repository-internal Taxonomy parity batch without reintroducing legacy ownership that the target model intentionally normalized away, and was squash-merged to `main` as `7dd71d75043e39304d340607f84246e7a0b4d525`.

Implemented/verified in this batch:
- `GET /api/v1/taxonomy/admin/bootstrap` gives platform admin a private/no-store lifecycle view including active, inactive and archived paths, levels, subjects and skills.
- public `core|compact|full` bootstrap behavior remains active-only.
- `/admin-dashboard/taxonomy` is a real responsive administration workspace linked from the admin shell.
- path, level, subject and normalized main/sub-skill create/edit/lifecycle flows use the existing canonical Taxonomy APIs.
- stable codes and IDs remain immutable after creation.
- no destructive Taxonomy delete action is exposed; inactive/archived lifecycle is used instead.
- the legacy `Section` concept is intentionally not recreated as a second canonical table; the target remains path / level / subject / main-sub skill hierarchy.
- authenticated admin reads are platform-admin-only.
- unsafe mutations remain platform-admin-only and CSRF protected.
- the teacher persona does not issue the admin bootstrap request, while server authorization independently fails closed.
- Database CI now asserts the lifecycle/hierarchy constraints and hot indexes used by the normalized model.

Final documentation-inclusive head `16e46b0cad521cde40be1228e8bb9be223b8c780` passed all four gates:
- Database CI `36313203873`.
- Backend CI `36313203900`.
- Frontend CI `36313203904`.
- Frontend E2E `36313203918`: 57/57 tests.
- browser evidence artifact `10929796659`, digest `sha256:b3b67ea515622b840f1393ac8dfad98af5abccf667d975671ae736499286238c`.

Release boundary:
- Taxonomy remains `TESTED`, not `PARITY_PROVEN`.
- deterministic V2 desktop/mobile Taxonomy admin screenshots exist, but direct legacy-runtime side-by-side visual comparison remains external evidence.
- PR #71 is merged; the next parity batch starts only from current `main`.

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

## Question Bank / Media integrated parity certification — TESTED
PR #72 closes the current repository-internal Question Bank / Media parity batch without copying legacy full-inventory browser patterns or moving binary ownership into Question Bank.

Implemented/verified in this batch:
- `/admin-dashboard/questions` is a real responsive staff workspace linked from the admin shell.
- bounded server-side list/search/filter and coverage are used instead of loading the full Question Bank into the browser.
- question creation writes canonical Taxonomy path/subject IDs plus exactly one main-skill relation and optional sub-skill relation.
- stable `questionCode`, current version and workflow state remain server-owned.
- staff detail/review uses the exact current version; admin approval/rejection/archive and teacher review submission reuse existing server workflow rules.
- no destructive question delete action is exposed.
- browser media flow computes SHA-256, requests the existing CSRF-protected presigned target, sends bytes directly to the object URL, completes server verification, then stores only the verified asset ID in Question Bank.
- the Go API does not proxy question image bytes.
- platform-admin V2 import UI requires an explicit dry-run PASS before enabling write; the durable server manifest hash/preflight remains authoritative.
- teacher UI omits admin-only import controls.
- Media direct upload is explicitly tested as staff-only.
- Database CI explicitly asserts Question Bank filter/media indexes, immutable question-code trigger, Media lifecycle/dedupe indexes and import preflight integrity.

First integrated certification head `dab9fea3d599355b0414c3fddf514556dde43fe8` passed all four gates:
- Database CI `36334171066`.
- Backend CI `36334171032`.
- Frontend CI `36334171048`.
- Frontend E2E `36334171056`: 61/61 tests.
- browser evidence artifact `10935993271`, digest `sha256:6d36703748032eb3281e2e0ee86137829907561a32654e0f97b427752f05ad12`.

Release boundary:
- Question Bank / Media remains `TESTED`, not `PARITY_PROVEN`.
- live R2 account/bucket, bucket CORS, `R2_PUBLIC_BASE_URL`/CDN delivery and real upload -> HEAD verify -> render smoke remain external deployment evidence.
- deterministic V2 desktop/mobile screenshots exist, but direct legacy-runtime side-by-side visual comparison remains external evidence.
- final documentation-inclusive head `2a98ad4d4e09c8ed7de0ef1cf0c62a5934f4cf88` passed all four gates: Database CI `36334351564`, Backend CI `36334351596`, Frontend CI `36334351571`, and Frontend E2E `36334351583` (61/61).
- final browser evidence artifact `10936483838`, digest `sha256:43e37c2ae7e81be630662d0b4c94a965e184c3aa92c247353e91edceb76e809a`.
- PR #72 was merged after that exact head was green; merge commit `d5c23a1ee856af77aac3e047ccb795622d1d0eb7`.

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

## Communication / Notifications Foundation — TESTED / MERGED
PR #64 passed all required exact-head gates on `8f25fefd239f0a75d0ff93dad3d521cea565c848` and merged to `main` as `6c178b3c0106f8ed52c649b21865d289f9be6a92`.

Implemented:
- normalized `notification_templates`, `notification_campaigns` and `notification_deliveries` with no delivery arrays embedded in User records.
- Communication owns template rendering, campaigns, delivery evidence, retry state and external provider adapters.
- Identity remains canonical user/contact/role authority; Communication receives only a narrow active-recipient projection and never performs foreign User SQL.
- platform-admin template create/update is CSRF-protected, optimistic through `expectedRevision`, and Operations-audited.
- campaign audience supports explicit user IDs and canonical roles, is de-duplicated server-side, and fails closed above 500 resolved recipients rather than truncating or partially creating a campaign.
- browser requests never provide arbitrary recipient email/phone authority; contact snapshots are resolved server-side from Identity.
- template variables preserve verified legacy `{{name}}` semantics, including missing placeholders rendering as empty strings.
- in-app delivery is persisted as `sent` with provider `internal` in the campaign transaction.
- email/WhatsApp deliveries are persisted as `pending`; provider calls never run inside campaign HTTP requests.
- authenticated `/notifications` inbox is self-scoped, with unread count plus CSRF-protected read/read-all mutations; recipient contact snapshots are not returned in the self-inbox DTO.
- `cmd/worker` now claims bounded external rows with PostgreSQL `FOR UPDATE SKIP LOCKED`, a five-minute lease and four total attempts using 1/2/4-minute exponential retry delays.
- provider adapters cover source-backed console, Resend, generic email HTTP, WhatsApp Cloud and generic WhatsApp HTTP modes.
- missing recipient/provider configuration fails closed and does not manufacture a successful delivery.
- responsive admin notification center and authenticated inbox are wired into the React application.

Verification:
- Database CI `36291528761`: PASS migration apply + notification schema/index/constraint verification + full rollback + re-apply.
- Backend CI `36291528793`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36291528776`: PASS typecheck + production build.
- Frontend E2E `36291528786`: PASS full suite including admin template/campaign and user inbox/read CSRF flows.
- browser evidence artifact `10922073896`, digest `sha256:ce7ac43ab1be32ead19713d5259f2194f1a6b0576f1d7377e5f3cad54ef59b03`.
- the initial Backend failure was formatting-only; all four gates reran green on the final exact head.

Audit:
- `docs/domains/communication/NOTIFICATIONS_FOUNDATION_AUDIT.md`.

## Communication / Notifications phase checkpoint
The deterministic notification foundation is now `TESTED`, not `PARITY_PROVEN`.

Still explicit external/policy boundaries:
- automatic parent weekly scheduling/delivery.
- parent WhatsApp/email opt-in, preference and consent semantics.
- marketing unsubscribe rules.
- provider delivery/read callbacks.
- Redis/SSE live fan-out.
- large 10,000-recipient fan-out beyond the current safe 500-recipient campaign bound.
- live Resend/WhatsApp Cloud credential proof.
- exact notification PII retention/purge duration.

These are not inferred from adjacent behavior.

## Smart Classroom / Realtime — TESTED / MERGED
PR #65 passed all required exact-head gates on `a84c389a383991f3f53002bf1199825f95fca3b7` and merged to `main` as `ac4310da776abe64762b3b1a46bfd413e1b8b56d`.

Implemented:
- Organizations now owns normalized SchoolContract/module truth and gates `SMART_CLASSROOM` by active school, active/valid contract and enabled module.
- teacher control requires the exact active school/class/subject teaching assignment; student join requires active school and class membership; supervisor/school-admin reads stay Organizations-scoped.
- platform-admin SchoolContract control is CSRF protected and optimistic through `expectedRevision`.
- Question Bank remains canonical for approved questions, exact versions, options, private correct keys and explanations. Realtime persists only exact `question_id + question_version` references and presentation state.
- initial classroom selection is bounded to 1–30 approved MCQ/true-false questions for the exact subject; appended batches are bounded to 1–20.
- durable PostgreSQL facts are normalized into sessions, batches, pinned questions, participants, latest responses and immutable final report snapshots.
- a partial unique constraint permits at most one live session for the same school/class; duplicate questions in one session are rejected.
- six-digit PINs are generated cryptographically, returned only at session creation, stored only as HMAC-SHA256 and expire after 30 minutes.
- student join is live-session-only and idempotent; joining records durable `present` attendance.
- single-question and batch publishing are supported. A learner can revise the latest answer while the question remains open; writes are rejected after reveal or batch end.
- selected option range and correctness are server-owned and resolved from the pinned Question Bank version. The answer response does not expose correctness.
- learner/projector projections omit correct option and explanation before teacher reveal and expose them only after the durable reveal transition.
- teacher attendance overrides support `present | late | absent | excused` and are audited; Redis presence is never treated as durable attendance truth.
- WebSocket authentication/authorization happens before upgrade. On connect/reconnect the client receives a role-safe snapshot, then compact Redis Pub/Sub deltas.
- Redis is restricted to short-lived fanout/presence with a 45-second presence horizon refreshed every 20 seconds; PostgreSQL remains durable truth.
- React uses bounded HTTP refresh as a WebSocket reconnect/failure fallback, so socket state is acceleration rather than a second state engine.
- ending a live session closes started batches, clears active pointers, uses the current canonical Organizations roster and writes one immutable PostgreSQL report snapshot with attendance and response aggregates.
- responsive teacher, student PIN/join/live room, projector and platform SchoolContract screens are implemented.

Verification:
- Database CI `36299477569`: PASS migration apply + classroom/contract schema/index/FK/immutable-trigger verification + full rollback + re-apply.
- Backend CI `36299477645`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36299477556`: PASS typecheck + production build.
- Frontend E2E `36299477576`: PASS all 39 browser tests including platform contract control, teacher create/start/publish/reveal/finalize and student PIN/join/answer mobile flows.
- browser evidence artifact `10924508359`, digest `sha256:3fb9e6394a294e9cc76bd9f346abeb357d0f970de7b50d0bd8d9827b2eebf83a`.
- early failures were corrected without weakening behavior: gofmt/duplicate domain type, malformed URL regex, query mock shape and a literal-plus Playwright locator. The four gates then reran green on the exact final head.

Audit:
- `docs/domains/realtime/SMART_CLASSROOM_AUDIT.md`.

## Smart Classroom / Realtime phase checkpoint
The source-backed classroom golden path is now `TESTED`, not `PARITY_PROVEN`: **authorized teacher -> canonical approved questions -> create/start -> student PIN join -> publish/answer/revise -> reveal -> attendance/aggregate -> immutable final report**, with role-safe WebSocket acceleration over durable PostgreSQL truth.

Still explicit policy/evidence boundaries:
- timed competition scoring and speed bonuses.
- automatic Learning mastery/Review evidence writes from classroom answers.
- anonymous/guest or cross-school public PIN participation.
- attendance inferred only from realtime presence.
- durable Redis classroom business state.
- reconnect rules that change response authority.
- SchoolContract limits beyond the verified module/validity model.
- exact retention/purge duration for classroom response history.

These are not inferred from adjacent behavior.

## AI Question Assistant / Provider Policy — TESTED / MERGED
PR #66 passed all required exact-head gates on `cd7c7ba1f5a77923da45a5ce37f1945c21867c76` and merged to `main` as `4d478fb972445ed66ba6a7270f31c53c454a73df`.

Implemented:
- normalized provider routing settings plus durable provider health/circuit state for Gemini, OpenRouter, Qwen, DeepSeek, OpenAI, Ollama and LM Studio.
- all provider routes are seeded disabled; credentials/runtime endpoints remain server deployment secrets and are never exposed to or managed by the browser.
- external provider URLs are constrained to known source-backed hosts; local Ollama/LM Studio endpoints remain deployment-owned.
- platform-admin provider enable/model/priority/output-token policy uses optimistic revision and audit evidence.
- fixed provider health testing plus bounded operational interaction ledger records provider/model/success/fallback/cache/latency/token/error metadata without storing full prompts, learner messages or full generated responses.
- learner Question Assistant is student-only, CSRF protected and scoped to one canonical owned Learning ReviewCard pinned to one exact Question Bank version.
- prompt context is bounded to question/options plus trusted hint/strategy/explanation, selected help level and at most 500 characters of learner follow-up.
- the server-owned correct-option field is not serialized into the AI prompt.
- progressive help levels are `hint | stronger_hint | concept | steps | follow_up`.
- deterministic trusted Question Bank fallback is returned when providers are unavailable rather than fabricating provider success.
- SHA-256 persistent cache and in-process identical-request singleflight suppress duplicate work.
- cache is evaluated before the provider-call budget.
- rolling learner provider-call guard defaults to 8 per minute; rate-limit fallback does not recursively consume the provider-call count.
- configured-provider cache defaults to 30 minutes; deterministic fallback cache is capped at two minutes so provider recovery is not hidden.
- provider circuit opens after three consecutive failures for 60 seconds and resets on success.
- responsive Review Library assistant UI and platform AI administration UI are implemented.
- AI remains advisory: it cannot mutate Assessment scoring, Learning mastery, Review evidence or Study Plan truth.

Verification:
- Database CI `36304139423`: PASS migration apply + AI schema/index/constraint verification + complete rollback + re-apply.
- Backend CI `36304139367`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36304139392`: PASS typecheck + production build.
- Frontend E2E `36304139375`: PASS complete browser suite including platform AI policy and learner Question Assistant flows.
- browser evidence artifact `10926955841`, digest `sha256:2607c29387452bf87a15f2286d8ca8a49ae49bad765931a31ffe539f49bf97d2`.
- the first final-head attempt exposed a duplicate output-token config parse at go vet; it was removed without changing policy and all four exact-head gates reran green.

Audit:
- `docs/domains/ai/AI_QUESTION_ASSISTANT_AUDIT.md`.

## AI phase checkpoint
The source-backed AI golden path is now `TESTED`, not `PARITY_PROVEN`: **provider policy/health -> owned ReviewCard Question Assistant -> deterministic cache/budget -> provider fallback**, with owning-domain IDs preserved and no AI mutation of canonical scoring/mastery truth.

Still explicit deployment/policy boundaries:
- live provider success proof requires configured deployment credentials/runtime.
- provider pricing/cost estimates require maintained provider pricing contracts.
- vision/image-byte tutoring, voice and long-term tutor memory are not implemented by inference.
- autonomous Study Plan generation and AI question authoring require separate product rules.
- distributed singleflight across API replicas and physical retention purge remain operational follow-up.
- no AI is introduced into active Assessment attempts without a separate source-backed policy.

## Reporting / Operations Foundation — TESTED / MERGED
PR #67 passed all four required exact-head gates on `08fe59c45b565c0f95fcdd9e26de273a22552d85` and merged to `main` as `93be0a938a7d06f2052475d030ebbc8b5d06b962`.

Implemented:
- Reporting is a read-only composition boundary over canonical Identity/Organizations/Assessment/Learning facts and does not create a second score, mastery, membership or assignment source of truth.
- `GET /api/v1/reports/overview` uses explicit student/result/evidence read budgets and reports population/sample/truncation separately.
- Student reporting is self-only.
- platform admin may read platform scope or an explicit school/class scope.
- school-admin aggregate/detail/export authority is gated independently by canonical Organizations report permissions.
- supervisor reporting respects exact active school/class supervisor scope and never widens a class-only supervisor to the whole school.
- teacher reporting requires active school membership plus the matching teaching assignment/class/subject.
- school reports include only school-context Assessment assignment/session evidence and do not mix platform self-study into school analytics.
- `GET /api/v1/reports/results` returns bounded result summaries only; learner answers, question bodies, correct options and answer keys are absent.
- `GET /api/v1/reports/results.csv` reuses the same authorization, requires explicit export authority where applicable and fails closed above 5000 rows instead of silently truncating.
- no unmeasured large background export/object-storage workflow was invented.
- Operations exposes platform-admin-only `GET /api/v1/operations/audit` and `GET /api/v1/operations/readiness`.
- audit review is bounded/filterable and immutable from this surface.
- readiness surfaces PostgreSQL/Redis, notification failure/retry counts, audit blocked/failed counts, live classroom count, enabled AI providers and whether deployment integrations are configured; it returns no provider secrets.
- backup/restore truth remains explicit: `external_proof_required`. Healthy application dependencies therefore produce at best `ready_with_notes` until a dated verified restore drill is supplied externally.
- migration `000038_reporting_operations_indexes` adds reversible indexes for chronological/status/action audit review, recent Assessment result sampling and scoped recent mastery evidence.
- responsive `/reports`, admin reporting workspace and `/admin-dashboard/operations` are implemented and linked from the admin shell.

Verification:
- Database CI `36306943000`: PASS migration apply + reporting/operations index verification + complete rollback + re-apply.
- Backend CI `36306943053`: PASS module lock + sqlc compile + gofmt + go vet + go test.
- Frontend CI `36306942943`: PASS typecheck + production build.
- Frontend E2E `36306943040`: PASS complete 45-test browser suite including self-scoped student report privacy and Operations external-proof behavior.
- browser evidence artifact `10928135095`, digest `sha256:d64c8774633136511b88f76336a4940979726d7c5bc90ff339f4adb42aa22078`.
- early gates caught formatting/source corruption, a Go helper collision and overly broad E2E locators. UUIDv7 and optional teacher UUID filtering were also hardened before the final exact-head rerun. No authorization/business behavior was weakened to turn CI green.

Audit:
- `docs/domains/reporting/REPORTING_OPERATIONS_FOUNDATION_AUDIT.md`.

## Planned implementation-order checkpoint
The source-backed implementation order through **Commerce -> Parents -> Communication/Notifications -> Smart Classroom/Realtime -> AI -> Reporting/Operations** is now merged and exact-head tested.

This is **not** equivalent to `PARITY_PROVEN` or production go-live approval. The matrix still records unresolved parity/release evidence, including Identity/provider live proof and visual parity gaps, production load/bandwidth evidence, dated backup/restore proof, exact retention/anonymization policy, external provider credentials/callback proof, observability/rollback/deployment identity proof and several explicitly UNKNOWN business-policy items. Those must stay visible rather than being converted into speculative implementation.

## Next exact action
Continue with Parents integrated parity certification from current `main`: re-audit canonical parent-child authority, overview, result summaries, weak skills/next actions, weekly report, explicit no-link state, privacy/observer-only boundaries and responsive mobile/desktop evidence. Preserve Communication-owned delivery/preferences and do not grant parents Assessment or Learning mutation authority.

## Foundation Learning / Content integrated parity certification — TESTED
PR #74 adds the authenticated learner `/learning` subject workspace over the existing bounded Content projection while preserving Taxonomy, Commerce, Assessment and Media ownership boundaries. Final documentation-inclusive head `ddf8961c606b8f9d3184997cc655f6be2cf3bae5` passed Frontend CI `36371378688` and Frontend E2E `36371378748` (62/62). Browser evidence artifact `10949426615`, digest `sha256:c731b5c03f32a9dc8c61c23775e1d5a5f6c19877077c198bf5440d724c1b6375`. PR #74 squash-merged as `2596e564854edf41e296998b0b641161d1d60a16`. Direct legacy-runtime side-by-side comparison remains external evidence; status is TESTED, not PARITY_PROVEN.

## Assessment integrated parity certification — IN PROGRESS
The certification batch audits definition/version, assignments, attempts, scoring, result/review, placements and public/barcode/live Session distribution against legacy commit `8724cd5081df75487e3207bf844e6db470fe0eda`. The source-backed learner Directed Assignment entry gap is implemented without exposing broad assignment inventory or moving audience authority into the browser. Implementation head `5867c6879540152aa2897507be8fc3fbe9bbcd50` passed Frontend CI `36371918890` and E2E `36371918901` (64/64), artifact `10949631044`. Same-domain legacy delta re-check is complete. Final documentation-inclusive head `5f0f3db3d7f40a2659db47f8f85866f73d1383a1` passed Frontend CI `36372298444` and Frontend E2E `36372298458` (64/64). Final browser artifact `10949179677`, digest `sha256:8404dbc8998f7f023f6777b36f0c1e84d6dd14f5e1cdbecbcbeeb4de720f79bc`. This certification slice changes no Go/database contract; the Assessment schema/backend gates remain those already merged with the underlying Assessment slices.

Assessment certification PR #76 merged as `43e3c98491aad8ee5a0610ced69d751f7c51fa82`.

## Review / Adaptive Learning integrated certification — TESTED / MERGED
Initial audit used legacy `8724cd5081df75487e3207bf844e6db470fe0eda`; closure re-check reached `6927f7e6a05447862b4872c5203503fb7296e69c`, whose FND26 taxonomy repair did not change Review/Adaptive contracts. The merged certification adds deterministic readiness over canonical SkillProgress and an explainable learner card for coverage, evidence confidence and recency; it remains student-scoped, AI-free and explicitly not an external score prediction. Final documentation-inclusive PR #78 head `ba9d44fcd28fc2cfd3759a1a234261dd10e55f96` passed Database CI `36376123212`, Backend CI `36376123245`, Frontend CI `36376123259`, and Frontend E2E `36376123154` (64/64). Browser artifact `10951385237`, digest `sha256:a3a5d19fa8128f122855cb16b9a48e7a709eaaf4674e9ebafd0907d09763b3f7`. PR #78 squash-merged as `c21874eeca576241c44fdd08507dfa87dae73121`. Status remains TESTED, not PARITY_PROVEN.

## Commerce integrated parity certification — TESTED / MERGED
The Commerce stack owns canonical products/packages, Entitlements, trusted checkout/discount/provider events, activation codes, school seats, Assessment access decisions, factual revenue/payout records, Tap hosted payment-link state and factual full refund/chargeback reversals. The source-backed school-commerce UX gap is closed: access codes may use a canonical School scope, and capped-seat assignment resolves School -> Class -> active Student through Organizations rather than raw UUID entry. Commerce issues no membership mutation and still performs authoritative membership/capacity/grant checks. Final documentation-inclusive PR #80 head `01b8df818d74e7a6a0ee1ba647f1e11da6875dae` passed Database CI `36377437385`, Backend CI `36377437374`, Frontend CI `36377437343`, and Frontend E2E `36377437469` (65/65). Browser artifact `10951730943`, digest `sha256:5434e2ffa1df40bb8df4ba92d766fe7c249dcf248e244703b8f6e68ac9043667`. PR #80 squash-merged as `de89512d4599f76ebc75365c9556fcbf94ee09d3`. Latest legacy `20a77c62fd2db4ef891a574241f4cfd6946011de` had no Commerce-domain delta. External/UNKNOWN boundaries remain live Tap sandbox/provider evidence, partial refunds/clawback, and Package multi-trainer allocation. Status remains TESTED, not PARITY_PROVEN.
