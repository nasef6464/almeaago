# Project Map

## Go
- `cmd/api`: API process.
- `cmd/worker`: jobs process.
- `internal/platform`: cross-cutting infrastructure only.
- `internal/<domain>`: domain/application/repository/transport/infrastructure/tests.

Domains: identity, organizations, taxonomy, content, media, questionbank, assessment, learning, commerce, parents, communication, realtime, ai, reporting, operations.

## React
- `apps/web/src/app`: composition/router/providers.
- `apps/web/src/features/<domain>`: domain UI.
- `apps/web/src/shared`: UI primitives, API, auth, telemetry, types.

## Database
- `migrations`: immutable schema changes.
- `db/queries`: sqlc queries.
- No runtime ad-hoc schema mutation.

## Contracts
`api/openapi` is the HTTP contract.

## Persisted presentation settings
`internal/content/{domain,application,repository/postgres,transport/http}/fonts*` owns the public font document and admin mutation. `content_platform_font_settings` (migration000044) stores a singleton JSONB patch merged atomically; audit shares the write transaction. `apps/web/src/features/presentation` reuses the approved Legacy font editor/bootstrap/utility with current Go auth/client adapters. It is presentation owned by content, not a new auth or operations domain.


## Homepage settings contract (migration000045)
`internal/content/{domain,application,repository/postgres,transport/http}/homepage*`
owns the public presentation document and admin mutation. Non-relational display
fields live in `content_homepage_settings`; ordered featured references live in
`content_homepage_featured_{paths,courses,lessons}` with foreign keys to existing
owner tables. Settings, reference replacement and audit share one transaction;
reads use one statement/snapshot. `internal/platform` remains infrastructure.
The current slice exposes an API contract only. Original HomepageManager and
Header/Landing consumers are the next dependent slice; UI parity is not claimed.
