# Question Bank / Media Parity Certification

Status: **TESTED — INTERNAL PARITY EVIDENCE GREEN / LIVE R2 + DIRECT LEGACY VISUAL EVIDENCE PENDING**

## Source basis

This batch reconciles the target Question Bank / Media domains against:
- the ALMEAA target ownership model where Question Bank owns stable question identity, immutable versions, workflow and relational skill classification;
- Media ownership of binary asset lifecycle, checksum identity and R2 direct-upload state;
- the existing V2 staff filters, coverage, versioned authoring, workflow and V2 import contracts;
- the read-only legacy QuestionBankManager / UnifiedQuestionBuilder observable staff workflow.

The legacy repository remains evidence only. Its browser-wide inventory patterns and destructive or duplicated state are not copied when the target architecture already has safer bounded contracts.

## Internal gaps closed

### Dedicated staff workspace

`/admin-dashboard/questions` now provides a responsive staff workspace for:
- bounded server-side question listing and search;
- path, subject, main-skill, workflow, type and linked/unlinked filters;
- coverage counters without loading the full question inventory;
- question creation with canonical Taxonomy IDs and one required main-skill relation;
- optional sub-skill classification;
- current version visibility;
- staff detail and workflow transitions;
- admin approval/rejection/archive controls;
- teacher authoring without exposing admin-only import actions.

The UI does not expose destructive question deletion. Lifecycle history remains version/workflow based.

### Media direct upload

Question authoring now has a browser-to-R2 upload path using the existing Media contracts:
1. browser computes SHA-256;
2. authenticated staff requests a CSRF-protected presigned target;
3. file bytes go directly to the presigned object URL;
4. browser calls the completion endpoint;
5. Question Bank stores the verified asset ID only.

Large media bytes do not pass through the Go API.

### V2 import workflow

Platform admin can operate the existing bounded V2 import contract from the staff workspace:
- JSON manifest is capped by the server at 100 items;
- dry-run is the first UI action;
- write remains disabled until the matching UI dry-run returns PASS;
- server-side manifest hashing/preflight remains authoritative;
- verified WebP asset identity and canonical source metadata remain server-validated;
- rollback semantics remain owned by the existing import API.

The old full-inventory browser XLSX pattern is not restored.

## Ownership boundaries preserved

- Taxonomy owns path/subject/skill hierarchy.
- Question Bank stores relational taxonomy IDs and question/version state.
- Media owns asset lifecycle, checksum identity and R2 verification.
- Assessment and Realtime consume pinned question ID + version references rather than copied question payload truth.
- Question Bank does not own learner attempts, scores or mastery.

## Existing security / integrity evidence retained

- platform admin + scoped teacher authoring rules remain server authoritative;
- unsafe Question Bank and Media writes remain CSRF protected;
- teachers cannot approve their own questions;
- exact current-version checks protect workflow/version mutations;
- learner-safe reads remain separate from staff detail;
- immutable `question_code` and exact-version foreign-key integrity remain in PostgreSQL;
- SHA-256 live dedupe and pending-upload expiry indexes remain in Media;
- V2 import keeps dry-run/preflight, provenance and archive-safe rollback behavior.

## Database evidence added

Database CI now explicitly asserts:
- `questions_taxonomy_workflow_idx`;
- `question_versions_filter_idx`;
- `question_versions_media_idx`;
- immutable question-code trigger;
- `assets_sha256_live_unique_idx`;
- `assets_pending_expiry_idx`;
- Media lifecycle status constraint;
- `question_import_batches_status_expiry_idx`;
- import preflight-shape constraint.

## External evidence still required before PARITY_PROVEN

Repository CI can prove the deterministic browser workflow against mocked direct-upload/provider boundaries, but it cannot prove:
- a live R2 account/bucket credential;
- live public CDN delivery through the deployment `R2_PUBLIC_BASE_URL`;
- direct side-by-side visual comparison against a running legacy environment.

Those remain explicit deployment/visual evidence requirements and are not converted into CI success.

## First integrated exact-head verification

Integrated implementation head `dab9fea3d599355b0414c3fddf514556dde43fe8` passed all four gates:
- Database CI `36334171066`: PASS — full migration apply, Question Bank / Media integrity assertions, rollback and re-apply.
- Backend CI `36334171032`: PASS — module lock, sqlc compile, gofmt, go vet and Go tests.
- Frontend CI `36334171048`: PASS — typecheck and production build.
- Frontend E2E `36334171056`: PASS — **61/61 browser tests**, including all four Question Bank / Media parity journeys.

Browser evidence:
- artifact `content-browser-evidence` id `10935993271`.
- digest `sha256:6d36703748032eb3281e2e0ee86137829907561a32654e0f97b427752f05ad12`.
- deterministic desktop Question Bank and mobile teacher screenshots are captured by CI.

Early verification caught two test/format defects only:
- a Go test-file gofmt delta;
- an ambiguous Playwright `اعتماد` locator colliding with the disabled shared admin-nav label `اعتماد المحتوى`.

Both were corrected without widening authorization, weakening media verification, bypassing dry-run import policy, or changing Question Bank ownership.

The documentation-inclusive final PR head must rerun the same four gates before merge.
