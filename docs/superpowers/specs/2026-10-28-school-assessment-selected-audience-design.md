# SCHOOL-005C3B — Directed school assessments for selected learners

## Intent

In the old Node school `QuizBuilder.tsx`, a central assessment can target groups AND named students. The Go version currently supports a class, multiple classes, or the full school, but cannot select individual learners. Preserve the current Arabic design, scoped school publishing and existing idempotency.

## Options considered

1. **Selected audience via existing assessment assignment tables (chosen)**: one school assignment, multiple class links and/or explicit learner links; reuse current reporting/student eligibility query. No migration, strict target check in a transaction.
2. Add a separate `school_directed_exams` model: duplicates assignment/report authority and creates parallel report logic.
3. Load all school students with the generic school roster API: unnecessarily ties test management to unrelated STUDENTS_VIEW privilege and can disclose sensitive fields.

Owner has explicitly opted out of additional questions and delegated implementation. Implement option 1; keep question selection and existing class/whole-school modes intact.

## Contract

- New `targetScope='selected'` with `classIds` (0..50) and `studentIds` (0..200); must select at least one class or learner. This permits groups, learners, and their union. `classId` must be empty. Existing `class`, `classes`, `school` unaffected; no `studentIds` accepted with those modes.
- Normalize UUIDs, remove duplicates, sort selected IDs in Go service before idempotency fingerprint. Same school + request key + same semantic audience resolves to one assessment even after a retry/reorder.
- DB transaction rechecks admin permission `SCHOOL_ASSESSMENTS_MANAGE`, active contract/module, all classes active and in same school, all selected learners active students of that school. Uses row locks; partial matches fail atomically, no public publication. Audit includes selected IDs count without disclosing passwords, answers or emails.
- Read endpoint `GET /api/school-access/director/schools/{schoolId}/academic/eligible-students?search=&page=&limit=` returns **only** `studentId`, `name`, optional `className` (no email or contact), bounded paging, active school students, protected by `SCHOOL_ASSESSMENTS_MANAGE` and active module both in Go service and SQL.
- UI: in current assessment creator's audience drop-down add `مجموعات وطلاب محددون`; lazy search/paging for learners; class checkboxes; selected learner chips persist across searches; no cross-school stale requests, mobile/desktop widths safe; disable publication until nonempty valid audience and approved questions.
- Existing report and learner roster queries continue to use `assessment_assignment_users` union with `assessment_assignment_classes`; no fabricated results.

## Non-goals / later batches

Creating assessment drafts, editing published content, clone/reopen/retake workflows, due-date scheduling, comparatives, question-level analytics; those need dedicated design and verification after this targeting slice. No Classera code or UI is copied.

## Acceptance

Service validation RED→GREEN; SQL integration with actual migrations for selected student, cross-school and inactive denials, idempotency; report audience union; HTTP privacy/permission tests; Playwright mobile/desktop selection, errors/stale cancellation, full suite, all four GitHub Actions gates on exact head before merge.
