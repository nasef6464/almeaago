# School director creator state isolation — verified regression guard (2026-10-30)

## Source / target
Legacy `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`:
`dashboards/SchoolDirectorDashboard.tsx` keys
`SchoolDirectorAcademicCenter` by `selectedSchool.schoolId+section`.
`dashboards/SchoolDirectorAcademicCenter.tsx` additionally calls
`setShowCreate(false)` when `school.schoolId` changes.

Go `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`,
owner PR #172 at `beed512043a092bf8503a5cb7f3d7d359447eff4`:
`SchoolDirectorDashboardPage.tsx` resets `showAssessmentCreator` inside
the `useEffect` dependent on `selectedSchool?.schoolId` (line ~206).
Although `changeSchool` does not reset that flag directly, the existing
effect **does** reset it on the next school selection. Initial static
inspection missed this effect; the hypothesis of a defect is **retracted**.

## Tests and outcome
Six browser tests cover two school-visit sequences at 390/820/1440 RTL:
- Open unsaved creator in A, switch to B where both schools have assessment
  entitlement; B creator remains closed.
- Open unsaved creator in A, switch to B without assessment entitlement,
  then return to A; creator remains closed.

Exact-head CI on `5cf7e62e71e52ae226033eea0962ba0f3b893b18`:
Backend PASS, Frontend PASS, Database PASS, Browser PASS;
**6/6 new Playwright cases passed** (146 passed, 3 skipped overall).
These are **mocked browser tests**, not real Go/PostgreSQL integration or
paired Legacy screenshots. Their outcome proves the observed UI behavior
in fixtures; it does not establish end-to-end entitlement or parity.

## Ownership and follow-up
- PR #172 owns `SchoolDirectorDashboardPage.tsx`; this PR adds only
  regression tests and documentation. No implementation change is needed
  for the hypothesized creator reset issue.
- Preserve the existing `selectedSchool?.schoolId` reset effect and
  school-visit epochs. Do not alter RBAC, assessment scoring or core.
- Further acceptance requires real A/B membership, assignment, audience
  and entitlement fixtures through HTTP/Go/PostgreSQL; and paired source/Go
  screenshots with matching roles/data/viewport.
- Current status: **VERIFIED for six mocked UI state-isolation tests**;
  **PARTIAL for full school journey**. No merge/deploy/production writes.
