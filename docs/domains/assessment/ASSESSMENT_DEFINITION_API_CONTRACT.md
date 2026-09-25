# Assessment Definition API Contract

Status: implementation contract for the first Assessment service slice.

## Scope
This slice owns staff definition/version authoring only. Learner attempts, scoring, realtime sessions, Commerce entitlement checks and Learning mastery side effects remain out of scope.

## HTTP surface
- GET /api/v1/assessments?page=&limit=&pathId=&subjectId=&workflowStatus=&search=
- GET /api/v1/assessments/{id}
- POST /api/v1/assessments
- PATCH /api/v1/assessments/{id}
- POST /api/v1/assessments/{id}/workflow
- POST /api/v1/assessments/{id}/publication

Unsafe routes require authenticated staff plus CSRF.

## Bounded reads
Default list limit is 50 and hard maximum is 100. List responses return items, page, limit and hasMore. They do not run an exact COUNT on each request. Search is trimmed and capped at 160 characters. Question selection is a separate bounded Question Bank search; Assessment never copies question payloads.

## Version semantics
Assessment identity and assessment_code are stable. Composition is versioned. An edit creates/replaces only draft composition according to the application contract; published composition is immutable. Every question placement stores canonical question_id plus exact question_version.

Publication must point published_version at an existing immutable Assessment version. Only approved definitions may publish. Workflow and publication use optimistic assessment revision checks.

## Authorization
Platform admin may create platform, teacher or school owned definitions. Teacher writes are normalized to teacher ownership and require active Content/Organizations author scope for the exact path+subject. Teacher list/read/edit is constrained to owned or assigned definitions. A teacher cannot approve a definition. School ownership must reference an active school and assignment must remain within authorized school/teaching scope.

## Workflow
draft -> pending_review -> approved/rejected
rejected -> pending_review
pending_review -> draft
approved -> archived or draft only through an explicit new-version path
archived is terminal for mutation.

Approval requires at least one question, valid exact Question Bank versions, valid section references, positive points, and valid Taxonomy path/subject. Draft cannot silently jump to approved.

## Transaction invariants
Create/update/version composition, workflow changes and publication write their audit event in the same PostgreSQL transaction. Question-version and Taxonomy validity are rechecked in the write transaction. Optimistic revision mismatch returns conflict. No cross-domain payload is embedded.

## Performance
Staff list uses the existing assessment staff indexes and limit+1 pagination. Detail loads one version and bounded composition. Section/question composition is loaded in deterministic sort order. Normal list endpoints never hydrate Question Bank bodies or answer keys.

## Required verification
Backend CI must pass gofmt, go vet and go test on the exact PR head. Database CI is required only if this slice changes schema. Merge only the exact tested head after all required checks are green.
