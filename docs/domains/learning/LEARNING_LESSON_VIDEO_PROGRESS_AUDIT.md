# Learning Lesson / Video Progress Audit

Status: **TESTED / MERGED**

## Scope
This checkpoint replaces legacy learner-level completion/video arrays with normalized Learning-owned progress rows.

## Data model
- `lesson_progress`: one learner + lesson + exact learning context row.
- `lesson_video_progress`: one resume position row keyed by `lesson_progress_id`.
- context is exactly one of:
  - Course: `course_id`.
  - Foundation: `topic_id`.

The context key prevents the same reusable Lesson from contaminating completion state across different learning placements.

## Ownership boundaries
Content remains authoritative for:
- whether a Course/Foundation target is learner-safe.
- whether the Lesson is actually linked to that context.
- Lesson type and duration.
- learner-safe Lesson detail payload.

Learning owns only:
- not-started / in-progress / completed learner state.
- video resume position.
- completion timestamp.

Learning does not query Content tables directly. A narrow Content resolver validates every read/write target.

## Security
- all progress APIs are authenticated student-only.
- video and completion writes require CSRF.
- hidden/archived/unpublished Content returns not-found through the resolver.
- locked Course lessons are rejected unless the Course placement is preview.
- locked Foundation lessons are rejected.
- Commerce entitlement is not fabricated by Learning.

## Progress integrity
- video position is bounded to 0..86400 and capped to canonical Lesson duration when duration is known.
- video position writes never mark a lesson complete automatically.
- completion is an explicit mutation.
- completed state is not cleared by later resume writes.
- direct HTML5 video resume is restored from server state and persisted on pause plus coarse periodic progress.
- the frontend does not optimistically mark completion before server success.

## Performance
- one learner/context progress row, not arrays on `users`.
- no exact-count query.
- active Lesson detail and progress are lazy loaded only for the selected Lesson.
- the Course structure remains the existing bounded Content projection.
- no per-module progress bootstrap/N+1 was added.

## Interactive-video boundary
The current normalized Content Lesson model does not yet own interactive-question entities. Therefore this batch deliberately does not invent a second question schema.

Legacy must-pass / answered-interactive-question persistence will be migrated only when the Content interactive-video authoring contract exists. YouTube/Vimeo SDK resume is also deferred; this batch provides reliable direct-upload HTML5 resume.

## UI
- new learner route: `/learning/courses/{courseId}`.
- responsive Course module/Lesson navigator.
- learner-safe locked state.
- direct-upload video resume and explicit completion.
- mobile Playwright proof covers resume persistence and explicit completion semantics.


## Verification checkpoint
- exact tested PR head: `78f26cf1aff797fec0a3cd8dc827f04c1f4626e2`.
- Database CI `36225203823`: PASS.
- Backend CI `36225203857`: PASS.
- Frontend CI `36225203909`: PASS.
- Frontend E2E `36225203838`: PASS.
- browser evidence artifact: `10900855682`.
- PR #51 merged to `main` as `125094a5f6e2af95aa0433c461fc96486133b6fc`.
