# Exact Legacy UI-5 Parent Workspace — Implementation Certificate

Status: **IMPLEMENTATION CANDIDATE — EXACT-HEAD FOUR-GATE VERIFICATION PENDING**

## Identity
- Phase: UI-5 role workspaces — Parent.
- Protected route: `/parent-dashboard`.
- Exact legacy source read first: `almeaacodax/pages/Dashboard.tsx` at legacy main `d4e5c831b632447e8b25009ffc17fee2076c67e5`.
- V2 base: Teacher merge `3775b4a6b32eb4d9806d6fb57e4c963dc8d932fc`.

## Source-backed parity
Legacy Parent presents a simple emerald follow-up workspace with child results, weak skills, reports and grouped account/follow-up entries. V2 already had the canonical child summary, deterministic Learning recommendations, bounded results and weekly report. This slice restores the missing recognizable quick-entry hierarchy without reintroducing legacy browser-owned calculations or mutations.

Quick entries now expose the existing canonical weekly report state, Notifications/parent digest surface and Profile. Results/skills/report remain the existing server-backed tabs.

## Authority retained
- Parent relationships and child scope come only from V2 Parents API.
- Learning recommendations are rendered as returned; no new recommendation is synthesized.
- Parent remains observer-only in this workspace.
- Legacy approvals and direct weekly-report-send mutations are not fabricated because no canonical V2 owner endpoint exists in this surface.
- Notifications owns parent digest preferences; Profile owns account state.
- No backend/schema/RBAC change.

## Responsive evidence
Existing Parent E2E is extended at 390px and desktop to assert the source-backed quick-entry region and no horizontal overflow while retaining canonical linked-child/result/skill/report assertions.

## Merge gate
Database CI + Backend CI + Frontend CI + Frontend E2E must pass on the same documentation-inclusive SHA. Latest legacy is re-checked immediately before merge.
