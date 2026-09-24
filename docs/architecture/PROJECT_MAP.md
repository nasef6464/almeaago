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
