# ADMIN-CONTENT-LIST-PARITY — bounded owner batch (2026-10-29)

## Immutable baselines
- Legacy `nasef6464/almeaacodax/main`: `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` (read only).
- Go `nasef6464/almeaago/main` at branch creation: `98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Draft PR: #188, branch `fix/admin-content-list-state-parity-20261029-run3`.
- Independent skills center and lesson create/edit/link/unlink remain owned by #160 (head `9a8e0692da0d8b579c8c91334b47c8768dd42e30`); no edits to its files.
- Source references: `dashboards/admin/CoursesManager.tsx`, `LessonsManager.tsx`, `LibraryManager.tsx` and `AdminDashboard.tsx`.

## Verified source-code discrepancy and exact scope
- Go's `ContentAdminPage.tsx` displayed a standalone English `Content Management` banner and a developer migration note; neither is a user control/text in the corresponding Legacy manager screens.
- Go displayed four generic aggregate cards `المعروض/المعتمد/الظاهر/المغلق` above the list; these cards are not in the corresponding Legacy managers. This change removes the Go-only cards, **not** any original course/lesson/library row-level statistics, approval actions, filters, editor, or pagination.
- The Go list retained rows from the old path/subject/tab during a new request. A manager changing scope could temporarily see stale rows. This is a UI-state issue; no RBAC claim or backend data-leak claim is made.

## Execution / regression
- Test-first commit `4021b3b86c0f593861674966620431f6d54c4c1d`: `apps/web/tests/e2e/admin-content-list-parity.spec.ts`.
- Fix commit `43790b8fcdb47f974fc56729dc994a5e5ab8cd0e`: removed non-Legacy banner/counters; cleared prior `rows/hasMore` immediately on a new list request. Existing AbortController, retry, error state, role and server contracts preserved.
- Playwright regression covers 390/820/1440 RTL, unchanged original actions, a delayed path change, HTTP 503, explicit retry and new scoped result. Tests use mocked HTTP; they do not prove PostgreSQL.
- CI links and results must be read on the **final PR head** before calling any gate VERIFIED.

## Acceptance matrix
| Contract | Status | Evidence / remaining work |
|---|---|---|
| Remove Go-only English/migration text and four summary cards | PARTIAL until browser CI | source diff + E2E assertions |
| Clear stale rows on filter switch | PARTIAL until browser CI | delayed-response E2E assertion |
| Preserve existing content actions and retry | PARTIAL until browser CI | existing content-management suite + new retry test |
| Legacy↔Go paired screenshots same actor/data at 390/820/1440 | NOT PROVEN | real paired runtime needed |
| Admin save → HTTP → Go → PostgreSQL → student visibility | NOT PROVEN | coordinate contract with student owner; no cross-branch write |
| Full admin dashboard and independent skills center parity | PARTIAL | #160 owns skills/lesson workflows; comprehensive review remains |

No main merge, deployment, cutover, production/Legacy writes, or scoring/payments/RBAC changes.

## Next slice
Complete separate admin path/subject/skills layout against Legacy with the #160 owner; collect paired screenshots and one real save→reload→learner consumer flow. Keep this bounded list-state PR separate to avoid file overlap.
