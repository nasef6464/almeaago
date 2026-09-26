# Learning Study Plans Audit

Status: **IN REVIEW**

## Legacy evidence used
Verified from the legacy repository:
- `StudyPlan` was self-owned by the learner.
- persisted settings: name, pathId, subjectIds, courseIds, startDate/endDate, skipCompletedQuizzes, offDays, dailyMinutes, preferredStartTime and active/archived status.
- the student Plan screen generated Lesson, quiz and Library-resource tasks across eligible dates.
- daily minute budget and off-days shaped the schedule.
- create/update/archive/delete existed.
- staff-created intervention plans used a separate route and school authority.

This V2 slice preserves the learner plan contract only. Intervention authorization is deliberately deferred.

## Ownership and schema
Learning owns:
- `study_plans`
- `study_plan_subjects`
- `study_plan_courses`
- `study_plan_off_days`
- `study_plan_items`

Plan items store references only:
- Lesson + Course IDs.
- Library item ID.
- Assessment learning-placement ID.

Question bodies, Assessment definitions, Lesson bodies, Media and external owner metadata are not copied.

## Cross-domain boundaries
Taxonomy:
- validates one active path and every optional active subject.

Content:
- validates selected approved/published/visible Courses.
- returns a bounded compact catalog of learner-safe Course Lessons and unlocked Library items.

Assessment:
- returns a bounded compact catalog of visible learning placements pinned to exact published Assessment versions.
- reports whether a placement is already completed and whether another attempt can start.

Learning does not issue arbitrary SQL against those owner-domain tables.

## Deterministic generation
Generation is server-owned and reproducible from:
- persisted Study Plan configuration.
- bounded Content/Assessment candidate projections.
- current Learning Lesson completion state.

Rules retained from the evidenced legacy behavior:
- exclude off-days.
- foundation → practice → review phase progression.
- prefer incomplete work.
- phase-specific item-type preference.
- selected subject order as stable priority.
- enforce the daily-minute budget.
- optionally skip completed Assessment tasks.

Bounds:
- max 50 subject IDs.
- max 50 Course IDs.
- max 100 candidates per owner-domain catalog request.
- max 160 generated plan items.
- max 180 calendar days.
- max 20 scheduled items per day.
- daily minutes 15–240.

No exact-count query is required.

## Authorization / concurrency
- student role only.
- plan list/detail/create/update/delete is scoped by authenticated student ID.
- unsafe writes require CSRF.
- updates require `expectedUpdatedAt`.
- date range, time format, IDs, status and all off-day values are validated server-side.
- deleting a self-owned plan cascades only its Learning-owned relation/item rows.
- archive is retained as the non-destructive normal lifecycle.

## Read behavior
- list defaults to 20 and caps at 100 using `limit+1/hasMore`.
- normal React entry hydrates only the first selected plan detail, not all list rows.
- optional Course selection loads learner-safe Content only after an exact subject is chosen.
- Study Plan detail hydrates compact titles/availability from bounded owner-domain catalogs.

## UI
`/plan` provides:
- path selection.
- active/archive views.
- create/update/reset/archive/delete.
- optional subject/Course scope.
- daily minutes, preferred start time and off-days.
- today/week/all schedule.
- completion percentage.
- canonical links to Course learning and Assessment placement entry.
- external Library links when available.

## Deliberately deferred
- staff/school Interventions and staff-created plans.
- Commerce entitlement enforcement beyond Content's current learner-safe visibility boundary.
- AI-generated plan rewriting.
- Realtime classroom scheduling.
- parent/school reporting.
