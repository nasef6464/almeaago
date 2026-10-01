# Exact Legacy Learner Notifications — UI-4 Implementation Certificate

Status: **IMPLEMENTATION CANDIDATE — EXACT-HEAD FOUR-GATE VERIFICATION PENDING**

## Identity
- UI phase: UI-4 Learner workspace.
- Protected surface: `/notifications`.
- Legacy source read first: `almeaacodax/components/NotificationBell.tsx` on latest legacy `main`.
- V2 base: merged Student Dashboard PR #113, main `ce2cf0482b97af5c24b88f87e48b0b83d04739c6`.
- Change type: presentation / learner entry-state parity only.
- Backend/schema/auth/RBAC changes: **NO**.

## Authority retained
Canonical V2 remains authoritative for inbox pagination, unread count, SSE refresh, CSRF-protected read mutations and parent preferences. No browser-owned unread count, delivery state or external-delivery success is fabricated.

## Source-backed parity restored
- learner workspace context above the notification title;
- legacy vocabulary for unread entry state: `N جديد`;
- explicit zero-unread state: `لا توجد إشعارات جديدة`;
- accessible notification-list region;
- existing V2 empty state retained.

## Responsive evidence
Playwright covers 390px empty learner state and 1440px unread state, including no-horizontal-overflow assertions and screenshots.

## Merge gate
Database CI, Backend CI, Frontend CI and Frontend E2E must all pass on one documentation-inclusive exact head, followed by final latest-legacy re-check.

## Final latest-legacy re-check
- Re-checked legacy `almeaacodax/main` at `5fe7a49af0241ec7532a1678fb68e616631a837a` immediately before the exact-head gate run.
- `components/NotificationBell.tsx` remains the protected source read for this slice; no later legacy commit exists at this checkpoint, so there is no additional notification delta to transplant.


## Merge evidence
PR #114 final documentation-inclusive head `e9609de9a356f9e0bd5a3d36f9d39c282466b9aa` passed Database CI, Backend CI, Frontend CI and Frontend E2E on that exact SHA and squash-merged to main as `6dc78ced2b56ffeb8cba0a4ae9c244614dac0a5c`. This notification slice is CLOSED; later UI-4 work must not reopen it without a concrete regression.
