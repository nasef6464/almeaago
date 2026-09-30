# Exact Legacy Review Library — UI-3 Implementation Certificate

Status: **IMPLEMENTATION CANDIDATE — FINAL FOUR-GATE EXACT-HEAD VERIFICATION PENDING**

## Identity
- UI phase: UI-3 Learning experience parity.
- Protected surface: `/review`.
- Legacy source checkpoint: `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`.
- V2 base main: `deed289a1c76081ae7c39414f8e6c3226af53af8`.
- Change type: **PRESENTATION ONLY**.
- Backend/schema/auth/RBAC/assessment scoring changes: **NO**.

## Legacy source audited
- `pages/Favorites.tsx`
- legacy route `/favorites`
- review product reference in `docs/architecture/QUESTION_REVIEW_SMART_TUTOR_REFERENCE_AR.md`

Legacy visual/interaction contract used here:
- “أسئلتي للمراجعة” header and dashboard return;
- saved vs mistakes two-source tabs;
- one review question in focus rather than a long answer-revealing list;
- answer remains hidden until “إظهار الحل”;
- previous/next question navigation;
- remove/save review action;
- “تدرّب على هذه الأسئلة” CTA;
- smart assistant remains attached to the canonical review card.

## V2 adaptation
Current V2 ReviewCard remains the data/authority source.

Intentional V2 boundary retained:
- V2 review library is path-scoped by contract. The legacy page was visually global.
- therefore the transplant retains a compact Path/Subject scope selector instead of weakening the API or inventing a cross-path browser aggregate.
- `/review` remains the canonical V2 route.
- `/favorites` is added only as a legacy presentation alias to the same V2 page.
- Review practice CTA maps to current `/review/practice` with the selected path/subject/tab.
- Mastery goals/readiness/next-action evidence is preserved below the legacy review flow; no current V2 capability is removed.

A deep-link bug discovered by the new legacy alias was fixed: an initial subject query value is no longer cleared while taxonomy bootstrap is still empty.

## Browser evidence
Implementation head `6f97c071444dea524018864b3984060097c2ffe3`:
- Frontend CI `36626299723`: **PASS**.
- Frontend E2E `36626299755`: **PASS — 80/80**.
- artifact `11060292454`.
- digest `sha256:500cb9ef0cf8b6922f21d6b65bc22181918b1c823802ec4fef309d12c039b405`.

Changed-surface evidence includes:
- 390px legacy-shaped review library flow;
- 820px `/favorites` alias with scoped V2 truth;
- answer-key reveal gating;
- no horizontal overflow on the tablet legacy route;
- existing AI/mastery-goal regression coverage remains green.

## Remaining UI-3
This certificate closes only the `/review` implementation candidate once the final exact-head gate passes.

Next protected surface:
1. `/review/practice`;
2. `/plan`;
3. learner `/assessments`;
4. assessment results;
5. `/reports`.

Before merge, the documentation-inclusive head must pass Database CI, Backend CI, Frontend CI and Frontend E2E on the same SHA, then latest legacy main must be re-checked.
