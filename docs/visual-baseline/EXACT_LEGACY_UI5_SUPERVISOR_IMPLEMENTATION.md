# Exact Legacy UI-5 Supervisor Workspace — Implementation Certificate

Status: **IMPLEMENTATION CANDIDATE — EXACT-HEAD FOUR-GATE VERIFICATION PENDING**

## Identity
- Phase: UI-5 role workspaces — Supervisor.
- Protected route: `/supervisor-dashboard`.
- Exact legacy source read first: `almeaacodax/dashboards/admin/SupervisorDashboard.tsx` at legacy main `d4e5c831b632447e8b25009ffc17fee2076c67e5`.
- V2 base: School Director merge `66641b11b5c27d4e18d780e8e6654d9eb4cb35dd`.

## Gap fixed
Legacy Supervisor exposes a recognizable seven-part operational hierarchy: overview, students, skills, reports, live sessions, tests and live monitoring. The V2 root previously exposed only school contexts plus three generic shortcuts.

This slice restores that source-backed hierarchy and a scope summary derived only from server-issued Organizations contexts. Canonical destinations are linked where they exist today: Reporting and School Interventions.

## Authority retained
- School/scope/permission/module facts come exclusively from `Organizations.contexts`.
- Reporting and interventions stay in their owner domains.
- Live sessions, tests and live monitoring remain visibly unavailable when no canonical supervisor owner flow exists in V2; the UI does not fabricate counts, data or mutations.
- No browser-side recreation of Legacy KPI/skill/result aggregation.
- No backend/schema/auth/RBAC changes.

## Responsive evidence
Playwright covers 390px and 1440px hierarchy visibility, server-derived scope summary, disabled unsupported owner flows and no horizontal overflow.

## Merge gate
Database CI + Backend CI + Frontend CI + Frontend E2E must pass on one documentation-inclusive exact head. Latest Legacy must be re-checked immediately before merge.
