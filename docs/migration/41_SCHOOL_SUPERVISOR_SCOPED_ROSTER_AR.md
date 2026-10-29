# SCHOOL-SUPERVISOR-ROSTER-03 — نطاق مشرف المدرسة وقراءة الطلاب

**Legacy authority:** `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` — `dashboards/admin/SupervisorDashboard.tsx`.
**Go base:** `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
**PR:** #177, Draft. No merge/deploy/cutover/production writes.

## Source delta and functional slice

The original supervisor sidebar has exactly seven entries in this order: `الملخص العام`, `تعلم الطلاب وجاهزيتهم`, `الحصص المباشرة`, `الاختبارات والتحليل`, `المراقبة الحية`, `خريطة المهارات`, `تقارير الأداء`, grouped under `الرئيسية`, `الطلاب والحصص`, `الاختبارات والمراقبة`, `المهارات والتقارير`. Default tab is students; `?tab=overview` and browser Back select the corresponding tab. Original `SupervisorDashboard.tsx` also provides evidence-based readiness, interventions, test operations, live monitoring and exports. These remain **PARTIAL/MISSING** in Go and are not simulated.

The Go page previously displayed invented permission/module counters, English `SUPERVISOR WORKSPACE` text, generic action cards and static tab spans. This slice removes those invented elements, restores original tab labels/order/groups, enables the original students and overview tabs, and fetches a **read-only scoped student roster**. Disabled original tabs remain visible but are **not functionally restored**.

## Vertical trace and authorization

`supervisor → /supervisor-dashboard → school selector/search/student rows → GET /api/v1/schools/context → GET /api/v1/schools/{schoolId}/roster?role=student&isActive=true&search=...&page=...&limit=20 → internal/organizations/transport/http/handler.go → application.Service.Roster → repository/postgres/roster.go → school_memberships, school_supervisor_scopes, class_memberships, classes, users`.

The server checks supervisor role and `CanAccessSchool`. PostgreSQL roster query constrains school-wide scopes or assigned classes via active `school_supervisor_scopes` and active memberships. The frontend does not infer authority from route or role alone, never calls director APIs, and invalidates stale responses when scope, school, query, tab, page or authenticated user changes. An error clears visible rows and allows retry while retaining the search draft.

**Scope limits:** The list is a roster, not an evidence-based mastery or skills report. No new RBAC rule, entitlement, scoring, assessment, schema or migration. Existing PostgreSQL integration coverage for the organizations roster is not replaced by mocked browser requests. A full real browser session + isolated PostgreSQL and same-data paired Legacy/Go screenshots at 390/820/1440 are required before parity certification.

## Test contract

`apps/web/tests/e2e/organizations-supervisor-roster-parity.spec.ts`: original labels/order and student default; school A/B isolation; overview tab URL and Back/Reload; failed context and roster reads; search draft retained on retry; 390/820/1440 screenshots (Go only). Test-first commit `ef993bb727fd4956afdc6b1f3c2373d36c3d4a6e`; whether the RED CI completed before subsequent commits must be verified from its workflow conclusion, not assumed.

**Acceptance state:** IMPLEMENTED, pending exact-head Frontend CI, Frontend E2E, Backend CI, Database CI and paired visual comparison. Remaining gaps: original supervisor learning evidence, skills map, live sessions, test management, monitoring, reports, action permissions, school/class filters and full RTL screenshot parity. Next slice: evidence-based student follow-up with reporting owner, no duplicate scoring or school assessment engine.
