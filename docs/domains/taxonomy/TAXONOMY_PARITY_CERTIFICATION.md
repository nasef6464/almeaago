# Taxonomy Parity Certification

Status: **TESTED — INTERNAL PARITY EVIDENCE GREEN / DIRECT LEGACY RUNTIME VISUAL COMPARISON PENDING**

## Source basis

This batch reconciles the target Taxonomy domain against:
- the ALMEAA target ownership map where Taxonomy owns paths, levels, subjects and normalized skills hierarchy;
- the existing V2 normalized persistence/public bootstrap/admin mutation contracts;
- the read-only legacy `PathsManager` observable administration workflow and its path/level/subject/skill management states.

The legacy repository is evidence only; its embedded/commercial/content concerns are not copied into Taxonomy.

## Internal gaps closed

### Dedicated admin lifecycle read

`GET /api/v1/taxonomy/admin/bootstrap` provides an authenticated platform-admin lifecycle view of:
- paths;
- levels;
- subjects;
- normalized main/sub skills.

Unlike the public learner bootstrap, this admin read includes active, inactive and archived records so lifecycle-safe administration does not lose hidden taxonomy rows.

The admin response is private/no-store. Public `core|compact|full` bootstrap behavior remains active-only.

### Responsive admin hierarchy workspace

`/admin-dashboard/taxonomy` now provides:
- path selection and path create/edit/lifecycle controls;
- level create/edit/lifecycle controls inside the exact path;
- subject create/edit/lifecycle controls with optional same-path level;
- normalized main/sub skill tree;
- main/sub skill creation with explicit parent selection for sub-skills;
- skill edit/lifecycle controls;
- desktop and mobile RTL evidence;
- explicit no-destructive-delete behavior.

Stable IDs and create-time codes are not rewritten by the UI.

### Target hierarchy preserved

The target model remains:
- Path.
- Level.
- Subject.
- main/sub Skill hierarchy.

The legacy `Section` concept is intentionally not recreated as a second canonical taxonomy table. Content, Question Bank and Assessment consume Taxonomy IDs through owner-domain boundaries rather than embedding ownership arrays in Taxonomy.

## Authorization and safety

- admin lifecycle bootstrap requires an authenticated platform-admin actor.
- unsafe create/update routes remain platform-admin-only and CSRF protected.
- the teacher persona is rejected by the UI before issuing the admin bootstrap request, and the server independently rejects a non-admin actor.
- no destructive Taxonomy delete action is exposed.
- hierarchy creation/update continues to use existing active-ancestor and same-subject parent validation.
- database constraints and indexes retain stable lifecycle and hierarchy behavior.

## First integrated exact-head verification

Integrated implementation head `efb3290b4f062921a2be2d12f0f7b55bc8338362` passed all four gates:
- Database CI `36312944722`: PASS — migration apply, Taxonomy lifecycle/index assertions, full rollback and re-apply.
- Backend CI `36312944713`: PASS — module lock, sqlc compile, gofmt, go vet and Go tests.
- Frontend CI `36312944712`: PASS — typecheck and production build.
- Frontend E2E `36312944720`: PASS — **57/57 browser tests**, including all three Taxonomy admin parity journeys.

Browser evidence:
- artifact `content-browser-evidence` id `10928894128`.
- digest `sha256:15166c4bacc9da83b4240ecb313c0fac4812145d937b9b1915ddb5b6a522ee8c`.
- deterministic Taxonomy admin desktop and mobile screenshots are captured by CI.

Early verification found only:
- a TypeScript narrowing issue in the shared admin navigation item shape;
- ambiguous Playwright text locators in the new Taxonomy tests.

Both were corrected without widening authorization, weakening hierarchy validation or changing data ownership.

## External evidence still required before PARITY_PROVEN

A direct side-by-side visual comparison still requires the legacy runtime to be available in the evidence environment.

Therefore this repository-internal batch targets **TESTED**, not `PARITY_PROVEN`.

## Final documentation-inclusive exact-head checkpoint

Final PR head `16e46b0cad521cde40be1228e8bb9be223b8c780` passed all four gates:
- Database CI `36313203873`: PASS.
- Backend CI `36313203900`: PASS.
- Frontend CI `36313203904`: PASS.
- Frontend E2E `36313203918`: PASS — **57/57 browser tests**.

Final browser evidence:
- artifact `content-browser-evidence` id `10929796659`.
- digest `sha256:b3b67ea515622b840f1393ac8dfad98af5abccf667d975671ae736499286238c`.

PR #71 was squash-merged to `main` as `7dd71d75043e39304d340607f84246e7a0b4d525`.

Taxonomy therefore closes this repository-internal batch at `TESTED`. It does not move to `PARITY_PROVEN` until direct legacy-runtime side-by-side visual evidence is available.
