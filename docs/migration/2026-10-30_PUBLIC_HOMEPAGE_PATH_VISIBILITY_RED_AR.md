# Public homepage path visibility — source-backed RED checkpoint

Date: 2026-10-30. Scope: ordinary visitor on homepage; **not** an authorization or database fix.

## Exact heads at discovery
- Read-only source: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`
- Target base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`

## Source behavior
`pages/Landing.tsx` constructs `homepagePaths` using:
- `path.showInHome !== false`
- `canSeeHiddenPaths || path.isActive !== false`
- nonempty `id` and `name`

Only **after** filtering, `displayedHomepagePaths` applies `featuredPathIds`. If none of the featured IDs remains eligible, it falls back to the full eligible homepage list. This means a hidden/inactive featured ID cannot reintroduce a card to an ordinary visitor.

## Target code finding (not runtime certification)
- `apps/web/src/features/public/pages/PublicLandingPage.tsx` currently sorts all `taxonomy.paths` and filters directly by `featuredPathIds`. It does not check `showInHome`, `isActive`, or blank names/IDs.
- `apps/web/src/features/content/api/content-types.ts` exposes `TaxonomyPath` without `showInHome` or `isActive`.
- `internal/taxonomy/repository/postgres/repository.go` filters `paths.status = 'active'` for public bootstrap, but the selected fields and `internal/taxonomy/transport/http/handler.go` response omit the separate homepage display flag.
- Therefore **UI source parity is missing**, but a live leak of inactive rows is **not proven**: the PostgreSQL public query already filters inactive status. No claims about production visibility or access rights are made here.

## RED acceptance (separate from implementation ownership)
`apps/web/tests/e2e/public-homepage-path-visibility-source-red.spec.ts` covers six cases: ordinary visitor at 390/820/1440 RTL with (1) visible + showInHome=false + inactive rows, and (2) featured IDs containing only a hidden row. It asserts the two eligible cards remain and the two excluded cards never render. Browser fixtures deliberately supply the flags so the UI contract can be isolated; they do not represent a complete live PostgreSQL trace.

## Ownership and exact handoff
1. **#166 public landing owner:** apply the Legacy eligible-path filter *before* featured selection; preserve the source fallback and the source's card/action/ordering rules. Remove invented placeholders, but do not invent a new empty state.
2. **#159 / #158 taxonomy/header owners:** decide one owner for exposing `showInHome` and active state in the public projection; confirm visibility and role semantics using a real PostgreSQL fixture. Avoid duplicate fields or client-side access decisions.
3. **#160 manager owner:** establish the authoritative setting that saves `showInHome`, with explicit false/omitted semantics. Coordinate an API contract rather than editing public files.
4. **Supervisor:** reconcile file ownership before integration, and run a same-data manager-save → PostgreSQL → visitor-reload trace; then paired Legacy/Go screenshots at 390/820/1440 for guest and allowed admin, including hidden/featured combinations.

## Evidence matrix
| Requirement | Status |
| --- | --- |
| Source filtering and target missing filter from code | VERIFIED (source inspection) |
| RED browser result | PENDING CI; do not claim before actual run |
| GREEN after owner implementation | BLOCKED by #166 and API ownership |
| Go/PostgreSQL actual persistence/visibility | NOT PROVEN |
| Paired Legacy ↔ Go runtime screenshots | NOT PROVEN |
| Backend, frontend, database, browser CI on exact PR head | PENDING |

No legacy/production writes, deployment, cutover, scoring, payments or RBAC changes. This PR is an **acceptance contract**, not a functional completion claim.
