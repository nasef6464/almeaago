# ALMEAA Go — استعادة جزء من رحلة تقرير الاختبار المدرسي

**2026-10-29 — SCHOOL-ASSESSMENT-REPORT-RETRY-ANALYSIS-01**

## مرجع التنفيذ

- Legacy read-only `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go base `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- PR #181, branch `fix/schools-report-retry-analysis-20261029`; no merge/deploy/cutover.
- Source components: `dashboards/admin/supervisorTests/SchoolAssessmentReportWorkspace.tsx`, `SchoolAssessmentSummaryPanel.tsx`, `SchoolAssessmentOverview.tsx`, `SchoolAssessmentMaterialAnalysis.tsx`.
- Go consumer: `DirectorAssessmentReportPanel.tsx` and `DirectorAssessmentLearnersPanel.tsx`; existing `organizationsClient.directorAssessmentReport` / `directorAssessmentLearners` APIs. No changes to scoring, payments, RBAC, schema or production.

## Proven source differences and corrections

1. Source report GET failure includes `إعادة المحاولة`; Go had an error-only paragraph. Added abort-safe retry with a new request revision; no stale report rendered during retry.
2. Source has three report views: `الملخص`, `الطلاب`, `المواد والمهارات`. Go had summary and learner results only. Restored the missing analysis entry and explicit absence of classified evidence, without fabricating subject or skill metrics.
3. Source summary offers `من لم يسلّم؟` and `من يحتاج دعمًا في هذا الاختبار؟` with preselected learner status. Go had no shortcuts. Reused the existing authorized roster endpoint and initialized the status per tab entry. No learner request when `canViewLearners` is false.
4. Restored the original submission progress and no-results semantics, which do not treat non-submission as poor mastery.

## RED/GREEN and validation scope

- Test-first commit `af5e0e7b28102e2bc6a68a1760bc011d4796d113`: `apps/web/tests/e2e/organizations-school-report-parity-retry.spec.ts` at 390/820/1440 RTL. This test fails on pre-fix behavior (missing retry, analysis and shortcut); a completed CI RED run must be linked before calling RED **VERIFIED**.
- Implementation commits follow on the same isolated branch. The tests use mocked HTTP for deterministic UI failures and scope changes; this is not proof of Go/PostgreSQL persistence.
- Exact-head Frontend, Backend, Database and Browser CI results must be inspected on the final SHA. Any missing or cancelled run remains PARTIAL.
- Screenshots produced by the test are Go-only. Legacy↔Go paired same-role/data/viewport screenshots are **NOT PROVEN**.

## Deliberate unresolved parity, not a false closure

- The original tab is labeled `الطلاب`; the Go label remains `نتائج الطلاب` to avoid breaking a shared legacy expectation in `organizations-director.spec.ts`, currently also changed by open PR #158. Single-writer coordination is required before changing that shared test.
- The original summary displays four primary metrics plus four inside `إحصاءات إضافية`; Go currently displays seven visible metrics. This is **PARTIAL**, not accepted parity.
- The source materials/skills view renders classified dimensions and breakdowns; the current Go report repository returns empty `subjects/sections/skills/subjectBreakdowns` by contract, so this slice does **not** invent rows. Real evidence hydration requires a separate assessment-owned API/data contract and PostgreSQL test.
- Source school assessment edit/clone/remind/reopen commands remain unimplemented in this slice; do not emulate or silently change authorization.
- Browser UI tests are HTTP mocked; no end-to-end session → Go → PostgreSQL → browser verification or paired Legacy screenshots yet.

## Next independent slice

Coordinate the shared test with #158 owner, then restore literal tab labels, primary/additional metrics and source tab keyboard navigation. Separately trace classified report dimensions through assessment result evidence and school scope with its domain owner; test an isolated PostgreSQL fixture before rendering non-empty analysis. Preserve the four distinct relationships: membership, teacher assignment, assessment audience, content entitlement.
