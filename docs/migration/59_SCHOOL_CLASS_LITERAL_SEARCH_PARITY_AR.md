# ALMEAA V2 — class search literal semantics, independent school slice

**2026-10-30 — PARTIAL until exact-head CI and PostgreSQL are verified.**

## Authority and boundaries
- Legacy read-only: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`. Original school classes are managed through `dashboards/admin/SchoolsManager/SchoolClassesPanel.tsx` and `SchoolClassOperatingCard.tsx`; do not alter their visible structure or invent class search controls.
- Go base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`. The existing `GET /api/v1/schools/{schoolId}/classes?search=...` path is retained. This is a correctness fix to the **existing** Go class search, not proof that Legacy had the same search UI.
- Go `buildClassListWhere` previously used unescaped `LIKE` for names, and `trim(both '%' from ...)` for exact codes. Percent and underscore entered by a user were treated as wildcards, while a code containing `%` could be miscompared.
- Keep school/role membership, class status, sort order, pagination, class mutations, teacher assignments, entitlements, and RBAC unchanged.

## Vertical trace and acceptance
School staff authorized for the class list → existing class selection/read → `GET /api/v1/schools/{schoolId}/classes` → organizations handler/application → `Repository.ListClasses` → `buildClassListWhere` → PostgreSQL classes + school memberships → same JSON/pagination consumer.

The narrow acceptance is literal name substring, case-insensitive; class code exact case-insensitive; trim leading/trailing whitespace; `%`, `_`, and backslash are literal; blank search does not filter. No cross-school or archived class appears, and an active school-admin membership is required by the existing predicate. The fix uses `strpos(lower(c.name), $n) > 0` and `lower(c.code) = $n` with a normalized argument.

## Tests and evidence
- RED commit `692362a1b6852d570a5c4faa1be016b7d313aeb6` adds `TestClassListLiteralSearchQuery` and `TestClassListLiteralSearchPostgres`. The first checks SQL and membership predicates; the second runs against a disposable PostgreSQL schema with two schools, an archived class, and special-character names/codes.
- The dedicated workflow `.github/workflows/school-class-literal-postgres.yml` runs the PostgreSQL test in CI, with no production database access.
- GREEN candidate `d36c7786582655a7c19c12bb9e868fa14416a1e2` modifies only `classes.go` search construction. CI outcomes must be read from the **final** head, not assumed from the candidate.
- Backend, Frontend, Database, Browser gates must be reported separately. Browser checks on unchanged school UI do not establish Legacy↔Go parity or end-to-end PostgreSQL integration.

## Ownership and unresolved parity
No changes to #162 parent, #165 teacher, #172 director, #177 supervisor, #181 reports, #187 assignment, #194 creator, #198 nav, #205/#208 RED UI tests, or #212 roster. The school director original table, seven-role journeys, assignment/entitlement separation, full HTTP→Go→PostgreSQL→UI tests, and paired 390/820/1440 RTL screenshots remain **PARTIAL/NOT PROVEN**. Do not merge/deploy/cut over or modify Legacy, production, scoring, payments or RBAC.
