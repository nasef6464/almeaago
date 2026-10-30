# ADMIN-SKILLS-LINK-SELECT-01 — original lesson-link dialog (2026-10-30)

## Authority and ownership
- Legacy read-only: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `dashboards/admin/SkillsTreeManager.tsx` lines 392–420 and 869–898.
- Go base: `nasef6464/almeaago/main@1f6d5a3db2cfba869ac48aee74903b99e17648e1`.
- Scope: independent `SkillsAdminPage` only, NOT Paths Center, global header, or the merged PR #160 lesson-editor implementation.
- Draft PR #251. This is NOT full Skills Center parity.

## Proven source-to-target gaps
1. Legacy lesson linking uses one `اختر الدرس` selector, `إلغاء` and `ربط`; Go rendered a button for every lesson, changing the original workflow.
2. Legacy Skills Center header has only `إضافة مهارة رئيسة`; Go invented a manual refresh icon.
3. Legacy tree has edit/delete/expand actions; Go added status selectors that are not present in the original. The status selectors were removed from this page without changing the underlying API.
4. Legacy orders subskills by `order`; Go list lacked an explicit sort. Go now uses persisted `sortOrder`.
5. Missing original delete, linked lesson/question/quiz/library counts, and full card layout remain OPEN, not silently certified.

## Implemented functional slice
- Replaced the row-wise link buttons with the original single-select + Cancel + Link interaction.
- Empty selection cannot submit. The selected lesson remains selected after a failed GET or PUT; the dialog remains open and exposes the server error. The user can retry.
- Before PUT, GET lesson detail validates the exact path/subject, editability, and duplicate skill association. PUT retains the existing `lessonLinkWrite` payload and optimistic revision.
- Page-one list fetch clears stale rows. Page-more deduplicates IDs. AbortController prevents stale HTTP responses from another request overwriting the list.
- Kept `عرض المزيد` only for server pagination and a recovery action on failure; these are backend transport necessities, not claims of exact pixel parity.
- Removed Go-only refresh/status controls from the Skills Center presentation. Did not alter status persistence, authorization, lesson schema, or other teams' files.

## Actor → UI → HTTP → application → PostgreSQL → consumer
Admin → Skills Center → subskill → Link existing lesson → GET `/api/v1/lessons?page=…&subjectId=…&pathId=…` → select → GET `/api/v1/lessons/{id}` → PUT `/api/v1/lessons/{id}` with CSRF + `expectedRevision` → `internal/content/transport/http/lessons.go` → `content/application` → `content/repository/postgres/lessons.go` transaction validates refs and ownership, updates `lessons` under revision/workflow constraints, replaces `lesson_skill_links`, audits and commits. The linked subskill then refetches GET `/api/v1/lessons?skillId=…` for the admin display. Learner-visible effect is NOT yet verified against an actual PostgreSQL session.

## Verification matrix
| Contract | Status | Evidence/limitation |
|---|---|---|
| Legacy selector/action source comparison | VERIFIED (code) | Legacy `SkillsTreeManager.tsx` selector and action |
| Go UI change and preservation of existing link write | IMPLEMENTED | `SkillsAdminPage.tsx`, unchanged `lessonLinkWrite` |
| Test-first RED | PARTIAL | Test-first commit `46f1f9310128630857097f6b4f5937416a800e46`; inspect GitHub E2E outcome before claiming observed RED |
| Frontend E2E mocked HTTP, cancel/selection/retry | PENDING | `apps/web/tests/e2e/admin-skills-separation.spec.ts`; GitHub PR checks |
| SSR parity contract | PENDING | `scripts/parity/admin-skills-separation.test.mjs`; GitHub Frontend CI |
| Go / isolated PostgreSQL / real role permissions | NOT RUN | No Go or SQL changes in this slice; live actor→database not reproduced |
| Paired Legacy↔Go screenshots 390/820/1440 RTL | BLOCKED | No paired same-role/data browser runtime in this execution environment |
| Original full Skills Center UI parity | PARTIAL | Missing original counters, delete controls, exact tree cards and other source actions |

No merge, deployment, production or Legacy writes. Next: review exact-head Frontend CI/E2E, fix failures, then implement original subskill layout and counts only with authoritative Go data and a live database/role fixture. The original delete behavior needs a separately approved safe contract rather than a destructive shortcut.
