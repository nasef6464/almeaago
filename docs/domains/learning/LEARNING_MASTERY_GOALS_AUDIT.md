# Learning Mastery Goals Audit

Status: **TESTED / MERGED**

## Verified legacy contract
Sources inspected before implementation:
- `server/src/models/MasteryGoal.ts`.
- `server/src/modules/quizzes/http/adaptiveMasteryRoutes.ts`.
- `server/src/modules/quizzes/http/masteryGoalSchemas.ts`.
- `pages/Reports/StudentMasteryGoalsPanel.tsx`.
- `pages/Reports.tsx`.
- Adaptive Phase 6 contract/evidence.

Verified semantics:
- learner-owned goal identity.
- path required, subject optional.
- target enum: `topic | section | path`.
- target mastery 50–100, default 90.
- horizon `short | long`.
- optional due date.
- status `active | achieved | archived`.
- student can manage own goals.
- legacy staff could target students only through existing report scope.
- goal is a tracking marker and does not mutate mastery evidence/progress.
- legacy student quick-create uses 14 days for short and 60 days for long.

## Target-model decision
The target platform has normalized `paths / subjects / skills` but intentionally has no canonical legacy `Section` table.

The verified legacy quick-create primarily used:
- `sectionId` when available for a short goal.
- otherwise the current `pathId`.
- long goal targets the path.

This slice therefore supports canonical `path` targets only.

`section` and `topic` remain accepted historical vocabulary in the domain enum but fail closed at create time until Taxonomy owns an explicit mapping. We do not silently reinterpret a legacy Section as a current Skill and do not attach a mastery goal to Foundation Topic by guess.

## Schema
Migration: `000025_learning_mastery_goals`.

Table: `mastery_goals`
- relational learner identity.
- creator provenance.
- canonical path and optional subject FKs.
- legacy-compatible target type/id.
- path target DB shape constraint (`target_id = path_id`).
- target mastery/horizon/status checks.
- date value stored as `date`, not presentation text.
- optimistic `updated_at`.

Indexes:
- learner + path + status + due date.
- learner + target + status.

No array is added to `users`.

## Authorization / boundaries
This batch is student self-service only:
- authenticated Student required.
- repository writes are constrained by `student_id`.
- POST/PATCH require CSRF.
- Taxonomy validates active path and exact optional-subject membership through a narrow resolver interface.
- Learning does not query Taxonomy tables directly.
- PATCH requires `expectedUpdatedAt`; stale/foreign goal updates fail as a conflict without leaking another learner's goal.

Staff-targeted goals are deliberately deferred. The legacy behavior depends on scoped-student authority; in V2 that must compose Organizations membership/teaching/supervisor scope rather than infer it in Learning.

## Query budget
- normal goal list defaults to 20 and caps at 100.
- `limit+1` provides `hasMore`; no exact-count query.
- exact path scope is required.
- optional subject narrows the query.
- no Question, Content, Media, Assessment or AI payload is loaded.

## UI parity
The `/review` Learning surface now carries the verified goal panel:
- “هدف قصير” and “هدف طويل”.
- one active goal per horizon in the current UI scope.
- 90% default target.
- 14/60-day quick due date.
- due date and target percentage presentation.
- achieve/archive actions.
- goal service loading remains independent from review-library loading.

## Explicit deferrals
- legacy Section target migration.
- legacy Topic target migration.
- staff-created goals for another learner.
- Study Plan persistence/generation.
- school Intervention creation/authorization.
- parent/school reporting of goals.

Those require separate contracts and are not inferred in this slice.

## Verification checkpoint
- exact tested PR head: `25c95ce69276f501b0d06934fb85b513420d5fbc`.
- Database CI `36227064502`: PASS.
- Backend CI `36227064489`: PASS.
- Frontend CI `36227064477`: PASS.
- Frontend E2E `36227064470`: PASS.
- browser evidence artifact: `10901058035`.
- PR #52 merged to `main` as `1d77971252e2b5aa98fad5321b77436cf516c473`.
- first-pass gofmt and Playwright mock-scope/routing failures were fixed on the same PR without weakening product behavior.