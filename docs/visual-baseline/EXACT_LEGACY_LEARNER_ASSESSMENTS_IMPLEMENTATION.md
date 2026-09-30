# Exact Legacy Learner Assessments — UI-3 Implementation Certificate

Status: **IMPLEMENTATION CANDIDATE — FINAL FOUR-GATE EXACT-HEAD VERIFICATION PENDING**

## Identity
- UI phase: UI-3 Learning experience parity.
- Protected surface: `/assessments`.
- Legacy source checkpoint: `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`.
- Legacy file: `pages/Quizzes.tsx`.
- V2 base merge: `867b72db2182d3313ac516281ea1154a1ee8098d` (PR #108 closure).
- Change type: **PRESENTATION / INTERACTION TRANSPLANT**.
- Backend/schema/auth/RBAC/scoring changes: **NO**.

## Legacy source audited
The learner catalog branch of `pages/Quizzes.tsx` was read before implementation. The transplanted contract includes:
- dashboard return and `اختبارات المنصة` learner heading;
- direct navigation to directed assessments and prior results;
- framed catalog section with strong separation from directed/school work;
- indigo/emerald action vocabulary;
- compact assessment cards with access/status chips and attempt metadata.

## V2 authority retained
The legacy broad client quiz catalogue was intentionally not restored.

Current V2 remains authoritative for:
- exact Learning Placement context: path + subject + slot (+ course/topic where required);
- bounded server-side availability reads;
- Commerce access decisions;
- max-attempt / `canStart` enforcement;
- CSRF-protected attempt creation;
- server-issued attempt identity and Assessment version;
- learner answer/scoring authority in the canonical attempt runner.

## Responsive / regression evidence
Playwright coverage now captures the learner catalog itself at:
- 390px mobile;
- 820px tablet.

The same journey retains:
- paid/locked placement denial;
- Commerce authority copy;
- available placement start;
- transition into the canonical server-created attempt runner.

## Merge gate
Do not mark this slice complete until one documentation-inclusive SHA passes Database CI, Backend CI, Frontend CI and Frontend E2E on the same commit, followed by a latest legacy re-check.

## Next protected surfaces
After learner `/assessments` closes:
1. assessment results;
2. `/reports`.
