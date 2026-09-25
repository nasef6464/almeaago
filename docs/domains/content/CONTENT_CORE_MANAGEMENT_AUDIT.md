# Content Core Management Audit

## Status

This document records the first bounded staff-management slice for the Content domain. It is intentionally narrower than full Content parity and must not be interpreted as learner cutover readiness.

## Included in this slice

- Courses: create, staff detail, bounded list, optimistic update, review workflow.
- Lessons: create, staff detail, bounded list, optimistic update, review workflow.
- Foundation topics: platform-admin structural create/detail/list/update with stable code and lifecycle.
- Library items: create, staff detail, bounded list, optimistic update, review workflow.
- Runtime mounts under `/api/v1/courses`, `/api/v1/lessons`, `/api/v1/foundation`, `/api/v1/library`, and Content management under `/api/v1/content`.
- Canonical Content-owned platform-trainer authoring scope via active path/subject relations, with transactional audit and fail-closed enforcement.
- PostgreSQL-backed taxonomy/skill validation and active Media asset validation.
- Transactional audit writes for content mutations.
- CSRF on unsafe HTTP mutations.
- Optimistic `expectedRevision` checks.
- Default page size 50, maximum 100, `hasMore` instead of an exact count on normal list reads.
- Teacher reads/edits are constrained to canonical owner/assignment and active trainer path/subject scope; `created_by` is audit provenance only and is not authorization.
- Staff list DTOs stay compact and do not hydrate skill/asset link collections per row.
- Relation validation is batched per write rather than issuing one database query for every skill/asset ID.

## Domain boundaries

Content owns canonical course, lesson, foundation-topic, library-item, composition and workflow state.

Taxonomy owns paths, subjects and skills. Content stores relational references and validates them; it does not copy taxonomy trees.

Media owns binary assets and R2 lifecycle. Content stores asset IDs only; image/file/audio bytes do not pass through Content APIs.

Commerce owns products, packages, payments and entitlements. No access-grant or price authority is added to Content.

Learning owns learner progress, mastery and next-action state.

## Security invariants

- Unsafe mutations require an authenticated session and CSRF.
- Teachers cannot assign ownership or assignment scope through client input.
- Platform trainers may self-create only inside canonical managed path/subject scope; ownership and assignment are forced to the authenticated trainer and revenue share remains admin-controlled.
- Admin assignment of a teacher is rejected unless that teacher is active and the target content taxonomy falls inside the teacher's canonical trainer scope.
- Non-admin edits preserve the existing canonical ownership/assignment tuple.
- Teachers cannot approve content.
- Draft cannot jump directly to approved.
- Approved/archived records are not edited in place by the normal update contract.
- Foundation structural mutations are platform-admin only in this slice.
- Audit write and content mutation share the same PostgreSQL transaction.

## Performance invariants

- List pagination is hard-bounded to 100.
- Normal lists return `hasMore` and avoid exact-count work.
- List SQL selects summary columns only.
- Skill and asset integrity checks are batched within a write transaction.
- Full relationship collections are loaded only for detail reads.
- Search relies on the content title trigram indexes already present on `main`.

## Explicitly deferred

The following are not complete in this PR and must remain separate work rather than being guessed into this slice:

- School-teacher authoring scope derived from canonical Organizations teaching assignments; the new platform-trainer path/subject scope does not silently substitute for school authority.
- Compatibility adaptation of legacy Identity `managedPathIds`/`managedSubjectIds` forms to the new Content-owned scope API; Identity still does not own these relations.
- Course module CRUD and module/lesson placement.
- Foundation topic -> lesson and topic -> library placement management.
- Explicit Course publication state separate from approval and show-on-platform visibility; legacy Course uses both `isPublished` and `showOnPlatform`, so learner catalog cutover must not infer publication from approval alone.
- Learner-safe approved/published/visible Content projections.
- Entitlement/access resolution.
- Assessment placement links.
- React management/learner screen cutover and visual-regression parity.
- Legacy Content settings that require a verified round-trip through builder -> API -> DB -> reload -> learner runner.
- A final policy for editing already-approved content beyond the current no-in-place-edit guard.

The older `feat/content-core-api` branch contains some composition experiments, but it is stale/diverged and has a migration-number collision with current `main`. Reuse from it must be selective, reviewed and retested; do not merge it wholesale.
