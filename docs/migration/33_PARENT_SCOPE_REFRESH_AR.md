# PARENT-SCOPE-REFRESH-01 — ولي الأمر: عزل النتائج عند تبديل الابن وإعادة تحميل العلاقات

**تاريخ:** 2026-10-29  
**Legacy read-only:** `nasef6464/almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`  
**Go base:** `nasef6464/almeaago@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`  
**Branch:** `fix/parent-scope-refresh-20261029`  
**PR:** #162 (Draft; do not merge/deploy without separate decision)

## Acceptance boundary

Parent opens results for linked child A → switches to linked child B → B's read fails → A's private result must not remain on B's screen → refresh relationship authority → B's result loads if still linked. If a relationship is revoked, refreshed dashboard and weekly report must not retain the revoked child's information. Non-parent users receive an explicit denial without parent API calls. Keep existing server-owned permission and assessment scoring unchanged.

## Source/target trace

| Stage | Authority / file | Contract |
|---|---|---|
| Original user journey | Legacy `pages/Dashboard.tsx` parent tabs and reports | Parent results and skills are scoped to linked children, never an unrelated student. Full visual parity is not claimed. |
| React screen | `apps/web/src/features/parents/pages/ParentDashboardPage.tsx` | Only render results tagged to current selected child; clear stale results/weekly on scope refresh and failure; retry same selection; explicit denied/error/empty states. |
| HTTP | `apps/web/src/features/parents/api/parents-client.ts` | GET `/api/v1/parents/dashboard`, `/children/{id}/results`, `/weekly-report` with AbortSignal. No new endpoint. |
| Go transport | `internal/parents/transport/http/handler.go` | Authenticated parent-only read facade, existing error mapping. |
| Go application | `internal/parents/application/service.go` | `Results` checks current `relationshipScopes` before calling Assessment; dashboard/weekly use bounded linked-child IDs. |
| PostgreSQL | `internal/organizations/repository/postgres/parent_authority.go`; `parent_student_relationships` | Active relationship + active student + student role + active school when scoped; no schema mutation. |
| Consumer | Parent results and weekly UI | Do not reuse stale data from a previous child or previously loaded authority. |

## Test-first history and limits

- RED test commit `f52b37ae2024227ae512e1436443f88c7fc9fdbd` introduced failing-on-old-behavior scenarios, but its CI runs were cancelled by later commits before a measured RED conclusion; **do not label observed RED**.
- Playwright `apps/web/tests/e2e/parents-scope-refresh.spec.ts`: 390/820/1440 result failure→refresh, non-parent denial, failed dashboard refresh, revoked child, weekly report after scope refresh. Browser screenshots are scoped Go fixture evidence, not paired Legacy visual proof.
- Go `internal/parents/application/service_test.go`: revoked relationship rejected before Assessment reader; active linked child remains readable.
- The existing PostgreSQL-backed authority reader is reused; this slice changes no SQL or authorization rules. CI database gate must be checked on final head; no live production database or R2 test.
- Four required CI checks (Backend/Frontend/Database/Frontend E2E) must be verified against the **final PR head**; no green status is inferred from prior commits.

## Status and remaining work

- **IMPLEMENTED / awaiting exact-head CI** for React stale-result isolation, refresh and failure/retry, and new authority regression tests.
- **PARTIAL** for end-to-end real Go/PostgreSQL runtime with a live revoked link: isolated browser fixtures and Go unit assertions are not a live DB round trip.
- **UNKNOWN / NOT PARITY PROVEN** for paired Legacy/Go parent screenshots at the same data/role/390/820/1440 and complete parent navigation/actions.
- **Next exact action:** inspect CI results for PR #162 head; repair any failures on the same branch, then run isolated PostgreSQL role/relationship revocation + paired browser captures when available. Do not merge, deploy or change RBAC/scoring.
