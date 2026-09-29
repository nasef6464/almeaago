# Exact Legacy Learning UI — UI-3 Implementation Certificate

Status: **TESTED / MERGED — UI-3 FIRST LEARNING SLICE**

Authoritative plan:
`docs/visual-baseline/EXACT_LEGACY_UI_TRANSPLANT_PLAN.md`

## Checkpoint identity

- V2 base main before this slice: `f847bb6f1c3790f6804d4bd9e3698990cf88bf2e`.
- Legacy source re-check used during implementation: `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`.
- Active phase: **UI-3 — Learning experience parity**.
- Change type: **PRESENTATION ONLY**.
- Backend/schema/auth/RBAC/Commerce scoring contracts changed: **NO**.

## Legacy source components audited

- `pages/GenericPathPage.tsx`
- `components/LearningSection.tsx`
- `components/CoursePlayer.tsx`
- `app/AppRouteTree.tsx`
- `utils/learningSpaceTabs.ts`

The legacy sources establish the protected route and interaction vocabulary used by this slice:
- `/category/:pathId?subject=...&tab=...`;
- five learning areas: courses / foundation / practice / assessments / library;
- `/course/:courseId`;
- sticky course-player header, module accordion/sidebar, mobile drawer, night mode, locked-lesson behavior and lesson navigation.

## V2 implementation surfaces

- `apps/web/src/app/App.tsx`
- `apps/web/src/features/learning/pages/LearningSpacePage.tsx`
- `apps/web/src/features/learning/pages/CourseLearningPage.tsx`
- `apps/web/tests/e2e/content-learning-space.spec.ts`
- `apps/web/tests/e2e/learning-lesson-progress.spec.ts`
- `apps/web/tests/e2e/commerce-foundation.spec.ts`

## Route adaptation

Legacy-looking compatibility routes are presentation aliases only:
- `/category/:pathId` -> current V2 Learning Space runtime.
- `/course/:courseId` -> current V2 Course Learning runtime.
- canonical `/learning` and `/learning/courses/:courseId` remain supported.

Legacy query vocabulary is normalized in the frontend:
- `skills` -> Foundation presentation.
- `banks` -> Training entry backed by Assessment V2.
- `tests` -> Assessment entry backed by Assessment V2.
- `courses` and `library` retain their visible legacy vocabulary.

No backend route ownership was moved.

## Data / authority adaptation

- Taxonomy and learning-space content come from existing bounded V2 Content APIs.
- Course lesson data comes from the existing learner-safe Content projection.
- Video resume and completion remain server-owned Learning progress.
- Locked/paid content remains controlled by current Content + Commerce projections.
- No browser-side full inventory bootstrap was restored.
- No answer keys, scores, entitlements, prices or permissions are invented by the presentation layer.
- Strict-mode duplicate deep-link reads are deduplicated in-flight without creating a second client-side truth store.

## Responsive evidence

The browser suite captures:
- 390px: `content-learning-mobile.png`.
- 820px: `content-learning-legacy-tablet.png`.
- 390px: `learning-course-progress-mobile.png`.
- 1440px: `learning-course-legacy-desktop.png`.
- paid-course mobile access evidence remains covered by `commerce-course-access-mobile.png`.

The changed journey asserts no horizontal page overflow.

## Pre-documentation implementation evidence

Implementation head `36919c417574b48a2a80d57336ac79530e8d3822`:
- Frontend CI `36624050679`: **PASS**.
- Frontend E2E `36624050812`: **PASS — 79/79**.
- Browser artifact `11058834343`.
- Artifact digest `sha256:047c7deb7f3c13faf0a401df472c1d9267242f062d1e4ee083dfc65d82f22423`.

This evidence is a candidate checkpoint only. The project requires Database, Backend, Frontend and Frontend E2E to pass on the same final documentation-inclusive SHA before merge.

## Intentional differences / remaining UI-3 work

This slice does **not** claim that all Learning UI is complete. Current V2 server authority is intentionally preserved where legacy behavior was browser-owned.

Remaining UI-3 surfaces are handled in order from the authoritative plan and working set, beginning with:
- `/review`;
- `/review/practice`;
- `/plan`;
- `/assessments`;
- assessment result routes;
- `/reports`.

Legacy Course Player capabilities that depend on separate current-V2 ownership are not fabricated in this slice. Any later source-backed functional gap must be documented separately before backend work.

## Merge gate

Before PR #104 can merge:
1. this documentation-inclusive head must pass Database CI;
2. Backend CI;
3. Frontend CI;
4. Frontend E2E;
5. latest legacy main must be re-checked for a relevant Learning presentation delta;
6. PR must remain mergeable.

Do not mark this slice TESTED / MERGED until those conditions are actually satisfied.


## Final implementation closure

The documentation-inclusive implementation head `9429a08e53b0709eb0eda4916759628db4605cb4` passed all required gates on the exact same SHA:
- Database CI `36624605777`: **PASS**.
- Backend CI `36624605736`: **PASS**.
- Frontend CI `36624605743`: **PASS**.
- Frontend E2E `36624605925`: **PASS — 79/79**.
- final browser artifact `11059419668`.
- artifact digest `sha256:640f0c1fd3a32d9cd693320f6a85a741fe0c8856c72daadfe2c820b1a97282c0`.

Immediately before merge:
- V2 main remained `f847bb6f1c3790f6804d4bd9e3698990cf88bf2e` with no base drift.
- latest legacy main remained `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`; no newer Learning presentation delta appeared after the audited source checkpoint.
- PR #104 remained mergeable.

PR #104 squash-merged as `b7d0ec811f4ddf5cb8547572b2ccfdda3bc1308c`.

This closes only the first UI-3 slice (Learning Space + Course Player). The next protected incomplete surface is `/review`; UI-3 as a whole remains active.
