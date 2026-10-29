# School director creator school-visit isolation — RED acceptance (2026-10-30)

Source `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`:
`dashboards/SchoolDirectorDashboard.tsx` renders `SchoolDirectorAcademicCenter`
with `key={selectedSchool.schoolId+section}`. On school switch the academic
center remounts, and a previously open creator is not reopened automatically.

Target `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`
and school director owner PR #172 at
`beed512043a092bf8503a5cb7f3d7d359447eff4`:
`SchoolDirectorDashboardPage.tsx::changeSchool` resets selected assessment,
workspace, search, classes, students, teachers, assignment and active section,
but **does not reset `showAssessmentCreator`**. The creator's `key` isolates
form fields, yet the creator can reopen unexpectedly for the next school.

## Acceptance / single writer

- Owner of the page: PR #172. This stacked test PR owns **only a new E2E file and this document**.
- After opening an unsaved school-A assessment creator, switching to equally
  entitled B must leave the B creator **closed**, with the normal "إنشاء اختبار"
  button; returning to A after visiting a school without assessment entitlement
  must also leave the creator closed.
- A closed creator must never issue POST to another school. Preserve existing
  server-side membership/assignment/entitlement/RBAC checks and do not change
  scoring or assessment core.
- Suggested owner fix (not applied here): `setShowAssessmentCreator(false)`
  in `changeSchool`, alongside `setSelectedAssessment(null)`, and ensure
  pending A responses cannot mutate B. Do not clear the draft merely on
  same-school transient HTTP failure.
- New Playwright coverage: 2 scenarios × 390/820/1440 RTL. Mocked HTTP only;
  **not** Go/PostgreSQL or paired Legacy screenshots. Treat CI RED as proof
  only after a completed run, not from source inspection alone.
- After owner patch: GREEN, rerun four CI gates on exact SHA, then real
  Go/PostgreSQL school A/B context test and paired screenshots with matching
  fixtures/roles. No merge or deploy without separate authorization.

Status at authoring: **PARTIAL / RED EXPECTED**. No production or Legacy writes.
