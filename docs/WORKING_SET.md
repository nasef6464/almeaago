# Current Working Set

## Current phase
Foundation Release 0.

## Files allowed to change while closing this phase
- cmd/api
- cmd/worker
- internal/platform
- migrations
- db/queries
- api/openapi
- apps/web foundation shell
- .github/workflows/ci.yml
- foundation documentation

## Do not start yet
No Identity/Auth business implementation until Foundation CI is green.

## Next exact action
1. Observe Foundation CI.
2. Fix any failing job.
3. Mark Foundation Gate green.
4. Create Identity/Auth ADR + schema/API contracts.
5. Begin Identity/Auth as the first business slice.
