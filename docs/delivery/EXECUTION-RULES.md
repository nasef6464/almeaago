# ALMEAA 24h execution contract — 2026-11-05

## Mission and immutable constraints
Deliver ALMEAA Go/PostgreSQL with exact Legacy visual and behavioral parity, not a redesign. Never deploy production, spend money, change secrets, bypass security, suppress tests, or claim completion without evidence. The 24-hour window is a target; explicitly list unverified remaining work.

## Teams and file ownership
- DevOps/integration: workflows, test infrastructure, migrations orchestration, API contract, cross-team blockers. PR #265, then #266. Do not rewrite product UI.
- Student/learning: shared assessment engine, learner tests, save/resume/submit, results, skills, learning, whiteboard. PR #269; compare and reconcile older #262 before closing it. Own assessment engine for school consumers.
- Central admin: platform director, independent taxonomy (paths > skills > questions > lessons > courses), content, admin RBAC, archive/restore. PR #264. Do not edit student assessment engine or schools UI.
- Schools: school director/supervisor/teacher/student/parent, membership, school tests orchestration, two-tenant access, reporting. PR #268. Reuse shared assessment engine; do not fork it.
- Integration lead is a **role** of DevOps and release review, not a fifth implementation branch.

## Mandatory every-run protocol
1. Fetch live main SHA, own PR head SHA, open PRs and CI results. Resume exact previous checkpoint; never start from scratch or repeat reports.
2. Pick the oldest *finishable* owned PR and one complete vertical slice. Write an acceptance checklist before changes, with Legacy reference and actual persistence/authorization.
3. Inspect source, tests, and failing logs first. Fix root cause, not thresholds/snapshots/mocks. Use connected GitHub tools; if no writable checkout/real DB, use existing CI workflow and explain the exact limitation rather than inventing local test results.
4. Spend the majority of the run on implementation, tests and fixing failures, not narration. Do not stop after a trivial test-only change while the vertical slice is incomplete. Do not touch files owned by other teams; coordinate via issue #267.
5. Test at minimum relevant Go/unit/typecheck, disposable PostgreSQL migrations and readback, auth/RBAC/CSRF, cross-tenant denial when relevant, Playwright browser flow, and 390/820/1440 Legacy parity where relevant. Mock tests are supplemental only.
6. Merge only if required checks on exact head pass and review/ownership rules allow. Verify post-merge main. No production deployment.
7. Leave a durable checkpoint: exact SHA, files, tests/URLs, failing step, next command, owner, blocked dependencies. Status = MERGED & VERIFIED / READY FOR REVIEW / IMPLEMENTED BUT RED / BLOCKED; never an ungrounded percent.
8. If stuck on a blocker for a full run, publish exact failing log and hand off; move to another independent complete slice, not another speculative draft PR.

## Gate definitions
- **Implemented**: code committed to an owned branch.
- **Tested**: exact SHA has real DB/API/browser evidence and relevant security/parity gates.
- **Delivered**: reviewed, merged, main verified. Nothing else counts as complete.
- CI red, E2E cancelled, mock-only tests, or unmerged branch = incomplete.

## Immediate priorities
1. DevOps #265: Database CI 42024619529 fails screenshot byte equality at 390px in `platform-fonts-live.spec.ts`. Inspect artifact screenshots + attached select metrics; correct true rendering drift without weakening parity. Check all required CI.
2. Student #269: prove persisted assessment attempt→resume→submit→result→skill analysis through Go+PostgreSQL, preserving modern image/zoom/timer behaviors and reconciling #262.
3. Admin #264: real taxonomy archive/restore preserving references, with forbidden RBAC tests.
4. Schools #268: two-school tenant isolation in real PostgreSQL and director→teacher→student→report journey.
5. Integration issue #267 is the single blocker/contract log.

## Reporting
Per run: one-line outcome; PR/commit; exact passing and failing check links; verified Legacy comparison; what remains; next checkpoint. No celebratory reports for minor test changes.
