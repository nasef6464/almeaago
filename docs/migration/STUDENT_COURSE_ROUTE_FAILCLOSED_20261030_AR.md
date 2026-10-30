# ALMEAA Go — student course route fail-closed / original error and Back

**Batch:** STUDENT-COURSE-ROUTE-01, 2026-10-30. **Status:** PARTIAL until exact-head CI, real HTTP→PostgreSQL and paired screenshots.

**Authority:** Legacy `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` (read only). Go base `nasef6464/almeaago/main@1f6d5a3db2cfba869ac48aee74903b99e17648e1`. Draft PR [#250](https://github.com/nasef6464/almeaago/pull/250), branch `fix/student-course-route-failclosed-20261030-1011`. This slice does not overwrite the merged #161 review-media or #163 lesson-scope work, and does not touch #168/#200/#229 active foundation files.

## Proven gap and acceptance

Legacy `pages/CourseView.tsx` maintains `loadedRouteId` and `courseMatchesRoute`, unmounts the prior course during a route change, and displays **لم نتمكن من فتح الدورة** with the original **العودة للخلف** action when the incoming GET fails. Before this change, Go `CourseLearningPage.tsx` retained the prior `course` object after a new `courseId` GET failed and rendered its title/module list under the new URL; `error && !course` did not handle that state. Go also refetched the course on search-param updates (including lesson selection), potentially resetting the learner's active selection.

Acceptance: A→B client-side route transition must not display A's course/lesson while B is pending or failed; a failed B request shows the Legacy error and Back; browser Back to A and reload restore A; a 200 payload with `course.id !== requested courseId` is rejected before display. Verify 390/820/1440 RTL with student HTTP fixtures.

## Trace: actor → screen/action → HTTP → Go → PostgreSQL → consumer

| Layer | Ownership and scope |
|---|---|
| Student UI | `apps/web/src/features/learning/pages/CourseLearningPage.tsx`: route-owned `loadedCourseId`, separate `courseError`, fail-closed rendering, original error/Back, course GET no longer tied to lesson query changes. |
| HTTP | Existing `contentClient.learnerCourse(courseId)` → `GET /api/v1/learning-spaces/courses/{courseId}`; lesson detail `GET .../lessons/{lessonId}`; progress GET and explicit save/complete remain unchanged. |
| Go content | Existing `internal/content/application/learning_space.go::LearnerCourse`: validates actor and requested course, loads from content repository, applies course access. No new access decision or API contract. |
| PostgreSQL | Existing content learner-course repository and lesson-progress tables; **no schema/data write in this slice**. Scoped lesson progress remains protected by existing #163 tests, not re-certified by these new browser fixtures. |
| Consumer | Course heading/modules, lesson body/progress, error/Back, reload; cross-course payload cannot be rendered even if HTTP returns 200 with the wrong ID. |

## Implementation and evidence

- RED-first browser test commit `13831d5a087204d36c39d06ff98bff2d9f4cfe96`: `apps/web/tests/e2e/student-course-route-failclosed.spec.ts`. Its initial CI run was superseded/cancelled by subsequent commits; **do not claim a captured failing RED run**.
- UI correction commit `74da2fdd6252a5ffdc6b0ba4a189b5001cefc811`; follow-up mismatch payload and duplicate-title assertion corrections in later commits.
- Playwright: 390/820/1440 A→failed B→original error/Back→A→reload, plus a wrong-course HTTP response rejection test. Tests use mocked API responses and do **not** prove real PostgreSQL persistence or permission policy.
- Frontend CI and Frontend E2E are triggered by the scoped files; check their result on the final PR SHA. Backend CI and Database CI may not trigger for a frontend-only change; record them **NOT RUN** if absent, not PASS.
- Go-only or PostgreSQL integration: **NOT RUN IN THIS SLICE**. Existing #163 `lesson_progress_scope_integration_test.go` provides prior scoped storage evidence but is not a new end-to-end authenticated browser trace.
- Paired same-role/data Legacy↔Go 390/820/1440 screenshots: **BLOCKED** without a Legacy runtime fixture and matched accounts. Go E2E screenshots alone are not parity certification.

## Verification matrix

| Criterion | Status | Reason |
|---|---|---|
| Source-vs-target route/error behavior | VERIFIED (code comparison) | Legacy `loadedRouteId`/error/Back vs Go prior stale-course state; code fix scoped. |
| A→B failed GET / Back / reload | PARTIAL until final-head E2E | Browser fixture asserts transitions at three widths. |
| Cross-course 200 payload rejection | PARTIAL until final-head E2E | Explicit client-side ID check and test. |
| Lesson completion and isolated storage | PARTIAL / previously tested in #163 | Unchanged HTTP/Go/PostgreSQL path; no new live test. |
| Full course overview/tabs, no-autostart and full visual parity | NOT PROVEN | Legacy `CourseOverview` has substantial extra functionality; this slice does not claim to restore it. |
| Production, scoring, payments, RBAC, migration | NOT TOUCHED | No deployment, merge, cutover, production write or policy change. |

**Next:** inspect exact-head Frontend/E2E results and fix failures. Then implement the missing original course overview/tab/explicit-start journey as a separate scoped slice without inventing substitute UI; run real authenticated Go→PostgreSQL tests and paired Legacy↔Go screenshots before any parity claim.
