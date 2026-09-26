# Commerce / Assessment Entitlement Consumption Audit

Status: **IMPLEMENTED — CI REQUIRED BEFORE MERGE**

## Source contract
The target boundary keeps Assessment authoritative for definition/version/distribution/attempts and Commerce authoritative for Entitlements/access. The module boundary explicitly permits Assessment to consume Commerce entitlement checks and forbids replacing that boundary with cross-domain table ownership.

The legacy Assessment/Quiz behavior distinguished:
- base access: `free | paid | private | course_only`.
- learning-placement override: `inherit | free | paid | package`.
- placement `inherit` falls back to the Assessment/Quiz base access.
- private access is audience-oriented, while explicitly free placements remain free.
- paid/package learning placements are locked when the learner does not have the required package/access.

The target Commerce blueprint resolves access from public/free policy, active user Entitlement, eligible school Contract/seat grant, or an authorized special/public session.

## Normalized target model
Migration `000031_assessment_commerce_access` adds policy only:
- `assessment_versions.access_type` defaults to `free` and accepts `free|paid|private|course_only`.
- `assessment_learning_placements.access_type` defaults to `inherit` and accepts `inherit|free|paid|package`.

No Commerce entitlement state is copied into Assessment.

Defaults deliberately preserve existing migrated behavior.

## Effective access
Direct student attempt:
- `free`: allowed.
- `paid`: current Commerce scope required.
- `private`: denied; directed Assignment remains the audience-authorized distribution path.
- `course_only`: denied without exact Course placement context.

Learning Placement:
- `free`: always allowed at that placement.
- `paid`: Commerce scoped access required.
- `package`: Commerce Package/Membership entitlement required.
- `inherit`: resolves the pinned Assessment Version base policy.
- inherited `course_only`: requires a Course placement and current Commerce access for that course/scope.

Learner availability returns `accessAllowed`, `accessReason`, and folds access into `canStart`.
A placement start performs a fresh server-side Commerce check; the browser cannot promote a locked placement.

## Commerce resolution
Assessment calls a narrow Commerce application contract; Assessment never reads Commerce tables.

Commerce checks active, unexpired Entitlements and canonical Product/Package scope:
- exact Course product when Course context is allowed.
- Package/Membership items scoped by `all`, `course`, `path`, `subject`, or exact `content_type`.
- normal Assessment uses `tests`; mock Assessment uses `mock_exams`.
- school Entitlements are eligible only when the Package is unlimited.
- capped school Packages require the explicit user Entitlement created by the school-seat flow.
- a `package` placement override excludes standalone Course-product authority.

Organizations remains the active school-membership authority used by Commerce.

## Directed/public/session distribution
This batch does not turn every Assessment distribution into a purchase check:
- directed Assignment already verifies its audience.
- live Session already verifies its session and organization scope.
- public/barcode Session is the explicit anonymous/special distribution path.

Those flows remain the blueprint's authorized special/public-session branch.

## Adaptive / Study Plan
The Assessment Study Plan catalog now passes through the same effective access resolver before Learning receives candidate placements. A Commerce-locked Assessment is not recommended into a newly generated Study Plan.

## UI
- Assessment builder exposes the base access policy.
- Placement management exposes the per-placement override.
- learner availability displays a Commerce-locked state separately from exhausted attempts.
- the locked state is informational only; the server repeats the entitlement decision at attempt start.

## Required merge gates
- Database apply + schema verification + rollback + re-apply.
- Backend module lock + sqlc compile + gofmt + go vet + go test.
- Frontend typecheck + production build.
- Frontend Playwright including locked paid Assessment availability and existing Assessment/Commerce browser flows.

## Deferred
This slice does not add:
- a new standalone Assessment Product type.
- provider-specific payment-session SDK/API integration.
- trainer payout/revenue-share ledger.
- expanded refunds/chargebacks.

Those remain separate Commerce concerns.
