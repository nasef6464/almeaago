# Public Site + User Workspace Visual Migration

Status: implementation complete on PR #98; final documentation-inclusive CI pending.

## Purpose

The previous dashboard visual-parity batch intentionally left the public/general site unchanged. Local full-stack viewing then proved that the V2 root route still rendered the temporary `ALMEAA V2 / واجهة المنصة` shell rather than the source-backed public product experience.

This batch restores the public product identity and removes the remaining high-visibility root workspace placeholders without changing backend/domain ownership.

## Source basis

Legacy read-only checkpoint at batch start: `cc359e5fb77e4a1fbb77e86d6fd986bf555878de`.

Primary source-backed UI references:
- `pages/Landing.tsx`
- `pages/StaticInfoPage.tsx`
- `pages/Dashboard.tsx`
- `dashboards/admin/SupervisorDashboard.tsx`
- `docs/PLATFORM_SITE_MAP_AR.md`
- legacy platform typography defaults and font-management contract.

The target V2 blueprint also requires Landing identity, registration/login entry points, SEO/public data, and role-specific student/supervisor/school/admin workspaces without losing capability boundaries.

## Implemented

### Public landing
- Replaced the temporary root shell with a real responsive public landing page.
- Restored source-backed brand language including:
  - `المنصة الأولى للقدرات والتحصيلي`
  - `حقق المئة في اختباراتك`
  - `ابدأ التدريب مجانًا`
  - `لماذا يختار الطلاب منصة المئة؟`
  - `قصص نجاح نعتز بها`
- Brought the legacy homepage media into the V2 repository so the V2 public page does not depend on the legacy deployment at runtime.
- Added real public navigation and footer destinations.
- Replaced public privacy/terms placeholders and restored source-backed About/Contact/FAQ routes.
- Unknown routes now show an explicit 404 instead of the migration placeholder.

### Typography
- Loaded the legacy default `Tajawal` family at weights 300/400/500/700/800/900.
- Restored platform body/heading/navigation/button font variables with Tajawal as the default.
- This batch restores the legacy default presentation. The legacy admin-managed multi-font settings workflow is not silently claimed as migrated; it remains a distinct presentation-settings capability if/when implemented against a canonical V2 server contract.

### User workspaces
- `/dashboard` is now a real Student workspace hub linking only to implemented V2 Learning, Assessment, Review, Study Plan, Results, Reporting, Smart Classroom and Notifications routes.
- `/supervisor-dashboard` is now a real scoped Supervisor workspace, loading canonical Organizations contexts and linking to implemented Reporting/Interventions/Notifications routes.
- `/admin-dashboard` root is now a real administration overview linking only to already implemented administration centers.
- Existing School Director, Parent and Smart Classroom Teacher workspaces remain intact; no source contract was replaced by a decorative shell.

## Explicit boundaries

This batch does not:
- change authentication, RBAC, school ownership, data models or migrations;
- invent missing backend capabilities;
- turn planned admin navigation into clickable fake pages;
- claim live provider/staging evidence;
- claim production readiness or `PARITY_PROVEN`;
- implement the legacy dynamic HomepageSettings/PlatformFontSettings administration workflow without a canonical V2 server owner.

External/staging provider evidence, production-equivalent load/bandwidth, dated restore/RPO-RTO and governance/retention closure remain later release gates.

## Browser evidence

New deterministic Playwright coverage exercises:
- public landing desktop at 1440px;
- public landing mobile at 390px, including responsive menu;
- public/static-info tablet at 820px;
- Student root workspace on mobile;
- Supervisor and Admin root workspaces;
- horizontal-overflow assertions at the public responsive breakpoints.

Pre-documentation implementation checkpoint:
- SHA `62f6008c8960d6027ef5f356c398263a5289af26`
- Database CI `36548435204`: PASS
- Backend CI `36548435267`: PASS
- Frontend CI `36548435238`: PASS
- Frontend E2E `36548435200`: PASS, **76/76**
- browser evidence artifact `11023457284`
- digest `sha256:c8ee0da78b9a3c253aa232cd9582b144b8e45195b081bb930414baf414592bd8`

The final documentation-inclusive PR head must independently pass all four gates before merge.
