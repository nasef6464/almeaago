# Skills Center — source parity RED checkpoint (2026-10-30)

## Scope and authority

- Source (read only): `nasef6464/almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `dashboards/admin/SkillsTreeManager.tsx` lines 473–500, 515–540, 608–616.
- Target base: `nasef6464/almeaago` draft PR #160 at `9a8e0692da0d8b579c8c91334b47c8768dd42e30`. The Skills Center remains independent from Paths Center.
- No edits to #160's implementation, shared header, student pages, PostgreSQL schema, RBAC, scoring, payments, production, or Legacy.
- This is a **RED browser contract**, not an implementation or proof of full UI parity.

## Exact source differences confirmed by code

| Source control/state | Legacy | Go #160 | Required owner action |
| --- | --- | --- | --- |
| Summary counters | Six in this order: main skills, subskills, linked lessons, linked questions, linked quizzes, review files | Only first two rendered in `SkillsAdminPage.tsx` lines 195–198 | Restore all **original** four missing counters in the same order and style, not new cards; preserve unknown/loading/failed count semantics |
| Main skill subtitle | `N مهارات فرعية · Q سؤال · المادة · المسار` (question count is `—` if unavailable) | Omits `Q سؤال` entirely (line 209) | Reuse canonical question coverage by exact main skill, preserve unknown as `—`; do not synthesize zero on API failure |
| Main/subskill controls | Both show edit, delete, and expand controls | Edit, status and expand; delete missing (lines 212–213, 229–230) | Do **not** implement a destructive API without a reviewed dependency/authorization/soft-delete contract; owner must resolve deletion semantics with taxonomy and content consumers first |
| Skills hierarchy | Separate from path/subject management | Separate in #160 | Preserve; do not move Skills Center back into Paths Center |

## RED tests and acceptance

New isolated file: `apps/web/tests/e2e/admin-skills-legacy-controls-red.spec.ts`.

Nine Playwright cases = three contracts × 390/820/1440 px RTL with the same admin actor and fixed path/subject/main/subskill fixture. No destructive action is triggered. Tests assert source labels and order count, per-main question summary including explicit unknown semantics, and existence of both original delete controls.

The browser tests use mocked HTTP fixtures; they are **not** evidence of PostgreSQL integration or matched source/target screenshots. Do not mark GREEN by hiding the tests, changing the expected source, adding unrelated cards, or bypassing the controls.

## Owner integration contract (PR #160)

1. Reuse canonical `questions/coverage` scoped to the selected path/subject and the main skill; never treat a failed request as zero questions. The existing subskill question list remains scoped by exact `skillId`.
2. Restore the original six summary labels in their original order. For lesson/quiz/library counts, source the existing content/assessment/library owners' read APIs, not a second counting authority or guessed values.
3. Preserve save-failure draft state; #199 already owns its nine taxonomy 503 tests. Do not copy those tests here.
4. For deletion, first document Legacy semantics, linked lesson/question/assessment impact, HTTP permissions, and PostgreSQL referential behavior. Do not change RBAC or perform cascade deletion by inference. Until approved, this parity gap remains BLOCKED rather than silently removed from the contract.
5. Run browser at all three widths, compare paired full-screen Legacy↔Go screenshots with identical actor/data, and exercise save/503/retry/reload/back. Then run Backend, Frontend, Database, Browser gates on the **exact final SHA**.

## Status

- **VERIFIED (source inspection):** Legacy has six counters, per-main question counts and both delete controls; Go #160 lacks them.
- **PARTIAL:** new RED test file committed; live browser outcome and four CI gates pending on this branch.
- **BLOCKED:** implementation files are owned by #160; deletion safety and count API dependencies need explicit owner contracts.
- **NOT PROVEN:** real HTTP→Go→PostgreSQL→learner flow and paired screenshots.

Next: verify RED collection/run, hand off precise failures to #160, and implement a non-conflicting integration slice only after ownership is clear. No merge or deploy.
