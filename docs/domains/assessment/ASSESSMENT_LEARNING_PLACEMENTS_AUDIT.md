# Assessment Learning Placement Audit

Status: **TESTED / MERGED**

## Scope
This slice implements the normalized Assessment Learning Placement distribution surface on top of the existing `assessment_learning_placements` table.

Assessment owns:
- the placement row.
- the exact pinned Assessment version.
- visibility/order distribution metadata.
- placement-context attempt counting and start idempotency.

Content remains authoritative for whether a referenced learning target is learner-safe.

## Routes
Staff:
- `GET /api/v1/assessments/{assessmentId}/placements?page=&limit=`
- `POST /api/v1/assessments/{assessmentId}/placements`
- `PATCH /api/v1/assessment-placements/{placementId}`

Learner:
- `GET /api/v1/assessment-placements/available?slot=&pathId=&subjectId=&courseId=&lessonId=&topicId=&page=&limit=`
- `POST /api/v1/assessment-placements/{placementId}/start`

## Canonical target shapes
- `training` and `tests`: exact active path + subject only.
- `foundation`: exact active/visible Foundation topic in the same path + subject.
- `course`: exact approved/published/visible Course in the same path + subject; optional lesson must be an approved/visible lesson placed inside that Course.

No Content, Question or Media payload is copied into Assessment.

## Boundary decision
Assessment application depends on a small `PlacementContentResolver` interface.
The concrete Content PostgreSQL repository implements the resolver and validates its own entities.

Assessment repository does not query Course/Lesson/Foundation tables directly.

## Authorization
- staff create/list/update reuse Assessment definition authorization: admin or the owning/assigned teacher only.
- new placements require an approved + published Assessment.
- CSRF is required for placement mutations and placement attempt start.
- learner availability/start is student-only.
- start revalidates the Content target so a hidden/unpublished Content target cannot be used by a stale direct placement URL.

## Concurrency / history
- placement target and Assessment version are immutable after create in this slice.
- visibility/order updates use optimistic `expectedUpdatedAt`.
- historical attempts retain `placement_id`; placement rows are not destructively deleted by the UI.
- each placement pins the exact Assessment version that was published when the placement was created.

## Performance
- staff list defaults to 50, max 100, and uses `limit+1/hasMore`.
- learner list defaults to 30, max 100, requires exact path + subject + slot, and uses `limit+1/hasMore`.
- course/foundation learner discovery requires an exact Content context rather than broad inventory scans.
- learner availability computes attempt count per returned bounded placement only.
- Content course/topic selectors remain bounded.
- no exact-count query was introduced.

## Attempt integrity
Placement start:
- uses a bounded idempotency key.
- serializes against the placement row.
- counts attempts within the exact placement context.
- enforces the pinned Assessment version max-attempt policy.
- validates that the exact version still has scorable questions.
- writes `placement_id` and a small source_context reference only.
- uses the existing learner-safe Attempt projection after creation.

## UI
Staff:
- published Assessment rows expose “أماكن الظهور”.
- create supports training/tests/Foundation/Course and optional Course lesson.
- existing placement visibility can be toggled safely.

Learner:
- `/assessments` requires exact taxonomy scope.
- Foundation/Course context is selected from learner-safe Content projections.
- available assessments show attempt budget and start through the placement-context endpoint.
- mobile Playwright evidence is part of the batch gate.

## Deferred
- Commerce entitlement remains separate; placement does not own paid/free/package authority.
- Learning mastery/evidence side effects remain in Learning.
- public/barcode/live remains Assessment Session distribution and is the next separate Assessment batch.


## Verification checkpoint
- exact tested PR head: `e578d3a98d157b9143d713df4150ccd2f953c054`.
- Backend CI `36211820991`: PASS.
- Frontend CI `36211821001`: PASS.
- Frontend E2E `36211820983`: PASS.
- browser evidence artifact: `10895858161`.
- PR #47 merged to `main` as `3d45c6af4e5b03f5f2e136ae068f74c275f1cb93`.
