# SCHOOL-DIRECTOR-SCOPE-READ-02 — School director fail-closed reads

Date: 2026-10-29. Status: PARTIAL until final SHA CI and same-role/data visual parity are proven.

## Contract and evidence
- Legacy authority: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`; school director source and its school-scoped roster behavior remain the visual/interaction authority.
- Target starting point: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Read `AGENTS.md`, owner delivery contract, plan 03, parity matrix 26, pedagogical policy and school assessment ownership contract.
- Existing PR #162 owns parent scope; #165 owns teacher scope; #158 overlaps shared school tests; this PR writes only director dashboard, a new dedicated director E2E spec and this note. No edits to the teacher/parent branches or shared assessment engine.

## Verified source-code gap
- Director `refresh()` used `Promise.all` for classes, students and teacher assignments but kept old rows while requesting a new search; on a failed request, old student rows could remain visible with an error. No data should be presented as belonging to a failed query.
- Context revalidation previously retained old school data and could display a stale delegated school on failure; a missing context was shown as “no delegated school” rather than a failed read.
- The previous `schools.find(...) || schools[0]` fallback could silently display the first school when the selected identifier was not present.

## Functional slice
Actor: school director → existing school selector and student search → `GET /api/v1/schools/context`, `GET /api/v1/schools/:schoolId/classes`, `GET /api/school-access/director/schools/:schoolId/students?search=...`, `GET /api/school-access/director/schools/:schoolId/teachers` → existing Go organizations endpoints and PostgreSQL membership/assignment repositories.

- On context revalidation, invalidate school/visit/read epochs and clear sensitive rows, overview, assessments and stale forms before the next authorized context arrives. Aborted and late context reads cannot restore old scopes.
- Resolve selected school by exact authorized ID only, with no silent fallback to an unrelated school.
- On roster search/refresh, clear previous classes/students/teachers while the new scope is pending; guard every result and error by school ID, visit epoch and request epoch.
- Preserve the existing search input after failed reads. Failed context reads use the existing empty-state panel to display an error rather than suggesting the director lacks a school.
- No new cards, actions, routes, or entitlement decisions. Go, PostgreSQL schema, scoring, RBAC, commerce and production are unchanged.

## Verification and remaining acceptance
- Browser tests: `apps/web/tests/e2e/school-director-scope-failed-read.spec.ts` covers failed roster reads at 390/820/1440 RTL and failed context read.
- Existing director tests and backend/database CI are regression gates, not proof of new database writes.
- RED test-only commit `9e9edc5ad9e7486055ecf86373fbc62180a92baf` was created first; its workflow was cancelled by a subsequent push, so RED is **NOT PROVEN** unless a completed failure artifact is recovered.
- Final browser/CI results and exact final SHA must be read from GitHub Actions after this checkpoint commit.
- PARTIAL: paired live Legacy↔Go screenshots with identical actor/data, actual Go/PostgreSQL end-to-end browser session, all director/teacher/supervisor tabs, permission revocation mid-session and save-draft failure semantics remain to be proven.
- Next safe slice: implement original supervisor students/skills tabs backed by scoped Go evidence, without invented KPI cards or unauthorized cross-school reads; coordinate API ownership with school reporting.
