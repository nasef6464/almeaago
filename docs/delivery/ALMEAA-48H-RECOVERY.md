# ALMEAA — 48-hour recovery and delivery control (2026-11-05)

## Non-negotiable outcome
Restore the Legacy user journeys on Go + PostgreSQL with exact visual/behavioral parity. No redesign, production deployment, fake green tests, secret changes, or new draft PRs for work already owned by an open PR. **48 hours is a target, not an evidence-free completion promise.** Unverified areas remain explicitly incomplete.

## Current evidence and first blocker
- Existing open PRs: DevOps #265 and #266, admin #264, student #262 and #269, schools #268.
- Database CI run 42024619529 failed at `TestPlatformFontsHTTPPostgres`: strict component screenshot mismatch at 390px in `apps/web/tests/e2e/platform-fonts-live.spec.ts`. PostgreSQL migrations and preceding repository tests ran; do not claim that all DB tests failed.
- Download `persisted-fonts-browser-evidence` from that run, compare source/Go 390px screenshots and attached computed select metrics, and reproduce at the exact PR head before changing rendering or capture. Do not change the equality threshold or snapshots to hide drift.
- #265 already contains API mount inventory reconciliation and CI changes. Validate actual `router.Mount` source registrations (35) and CI on head before review/merge.
- Frontend CI on student #269 and schools #268 remains red; E2E was cancelled. Inspect the *first failing job* and separate common failure from branch-specific failures.

## Ownership and parallelism
| Lane | Existing PR | One deliverable at a time | Evidence required |
|---|---|---|---|
| DevOps | #265 then #266 | Fix shared CI root failure, reliable PostgreSQL+Chromium gates, contract/ownership checks | green workflow run URL on exact head SHA |
| Student/learning | #262 comparison, #269 | Persist/resume/submit/grade/skill-analysis with shared Go assessment engine | real Go HTTP→PostgreSQL readback + browser journey, RBAC/CSRF |
| Central admin | #264 | Taxonomy archive/restore with relations intact | real HTTP→PostgreSQL readback + forbidden request test |
| Schools | #268 | Two-tenant isolation and director→teacher→student→report | real PostgreSQL fixtures, cross-tenant denial, browser journey |

No lane modifies another lane's owned UI or assessment engine. API contracts and conflicts go to #267 with request/response examples. Do not rebase/cherry-pick stale UI over newer main without file-level comparison.

## Execution gates (apply to each slice)
1. Record main SHA, PR head SHA, changed files, Legacy screen/behavior reference, and failing workflow step.
2. Make the smallest *complete* vertical change on its existing PR branch.
3. Test unit/typecheck, Go API, disposable PostgreSQL migration+readback, auth/RBAC/CSRF/tenant isolation, then Chromium Playwright and 390/820/1440 visual parity.
4. Attach CI URL, screenshot/trace if applicable, precise SQL persistence assertion and reload proof; mock-only tests are regression coverage, never full-stack acceptance.
5. Obtain review and all required green checks before merge. Verify post-merge main; never deploy to production as part of recovery.

## Timeboxes and stop conditions
- **0–4 hours:** capture live baseline and CI logs; fix the first common red gate in #265; coordinate #267.
- **4–12 hours:** run shared test infrastructure and enable real isolated DB evidence; each feature lane chooses one end-to-end slice.
- **12–30 hours:** implement/test student, taxonomy, and schools slices in parallel; keep PR count stable.
- **30–42 hours:** visual/functional Legacy comparison, fix regressions, complete reviews.
- **42–48 hours:** merge only green/reviewed slices, re-run main, publish explicit completed/remaining matrix and next checkpoints.
- If a gate stays red, mark slice **blocked/incomplete**; never invent a finish percentage or call an unmerged mock test a delivered feature.

## Next concrete actions
1. DevOps: inspect artifact screenshots and select metrics from Database CI 42024619529, fix real 390px drift on #265, rerun.
2. Student: compare #262 against current main (preserve QuestionAssetImage/zoom/timer/submit confirmation), then real persistence contract on #269.
3. Admin: PostgreSQL archive/restore with FK preservation and forbidden authorization on #264.
4. Schools: real two-school fixture and cross-tenant denial on #268.
5. Every lane posts only new evidence and exact checkpoint to #267, not repetitive status updates.
