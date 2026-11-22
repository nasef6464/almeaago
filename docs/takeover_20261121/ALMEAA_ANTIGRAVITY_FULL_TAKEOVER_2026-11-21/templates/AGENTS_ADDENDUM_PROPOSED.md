# ملحق مقترح إلى AGENTS.md — للمراجعة ثم PR صغير فقط

> لا تستبدل `AGENTS.md` الحالي ولا تضع هذا الملحق فوق تعليماته. انسخ فقط البنود غير المكررة أو تعارضات التوثيق بعد التحقق من حالة العمل المحلية وجميع الدساتير؛ الوثائق الحالية هي السلطة.

## Single accountable execution — Antigravity ownership

At the owner's current request, Antigravity is the accountable executor/integrator for ALMEAA Go work. It may use specialized agents, tools, and skills in `.agents/skills/` based on scope. There is one writer per owned file and one PR per coherent vertical slice. Review evidence must be independent of the patch author wherever possible; if unavailable, record the review limitation, never fabricate approval.

`docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md` remains the single active plan. Read `docs/ENGINEERING_COMPLETENESS_CHECKLIST_AR.md` as the existing engineering pillar registry; add missing pillar mappings rather than a conflicting second master plan. Any external handoff is subordinate to current `AGENTS.md`, owner product logic, latest Legacy main for parity, and safety restrictions.

At start: verify both repo remotes, current local/remote SHAs, changes/PRs, last checkpoint and current CI; preserve uncommitted work. At each slice: actor→UI→HTTP→Go owner→Postgres/external→report, expected Legacy behavior, test first, exact-scope negative auth, real DB evidence where applicable, 390/820/1440 paired RTL screenshots where visual, and required exact-head CI before merge.

Never claim `DONE`, `PARITY_PROVEN`, or production readiness from code build, mocked tests, route counts, agent activity, partial CI, or existence of a document. Distinguish `VERIFIED`, `PARTIAL`, `UNKNOWN`, `BLOCKED`, and `INTENTIONALLY_CHANGED` with links to evidence. No production data/migrations/deployment, no Legacy writes, no auth/RBAC/scoring/payment changes without explicit approval and tests. No test suppression/bypass to create green results.

Initial work: reconcile branches/PRs and E2E root-cause failures from run 44890325571, then fix one verified P0 golden journey slice. Scan dependency security on its own scoped PR. Operations Research is a later feature-flagged capability reusing canonical QuestionBank/Assessment/Learning, not a parallel source of scoring or entitlement.
