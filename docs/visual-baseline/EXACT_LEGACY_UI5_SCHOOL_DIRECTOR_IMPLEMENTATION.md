# Exact Legacy UI-5 School Director — Implementation Certificate

Status: **IMPLEMENTATION CANDIDATE — EXACT-HEAD FOUR-GATE VERIFICATION PENDING**

## Identity
- Protected route: `/school-director-dashboard`.
- Exact legacy source: `almeaacodax/dashboards/SchoolDirectorDashboard.tsx` at `d4e5c831b632447e8b25009ffc17fee2076c67e5`.
- V2 base: Parent merge `f6bf96186ed384c5fa59b2eff5e1dbe6b1fd1ed9`.

## Parity assessment
V2 already preserves the core Legacy director presentation: delegated-scope hero, school selector, student/class/teacher operational cards, student operations and permission/module gating. It is stronger on responsive student cards and CSRF-backed writes. No blind rewrite is warranted.

This slice restores the recognizable academic-operations entry hierarchy as a dedicated source-backed card for intervention plans and reports, while retaining the existing V2 management implementation.

## Authority retained
All school contexts, permissions, modules, rosters, class changes, teacher assignments and CSRF writes remain Organizations-owned. Reporting and intervention destinations remain their canonical V2 owner surfaces. No backend/schema/RBAC change.

## Responsive evidence
Existing Director E2E already covers desktop operations, school isolation, optional module gating, mobile no-delegation state and populated 820px tablet no-overflow. It is extended to assert the academic operations entry region.

## Merge gate
Database CI + Backend CI + Frontend CI + Frontend E2E on one documentation-inclusive SHA, latest legacy re-check, merge/read-back.
