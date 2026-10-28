# P1 — Readiness page integrity guard (2026-10-28)

**Scope:** `internal/learning/application/service.go::Readiness`; no API/DTO, scoring threshold, DB schema, or production data changes. Source Legacy main `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`; Go base main `fec689b32ae442c72586133f4cc511efc9f91c54`.

## Verified gap

Go reads skill progress with `ORDER BY mastery ASC,last_evidence_at DESC NULLS LAST,skill_id LIMIT/OFFSET` from `internal/learning/repository/postgres/repository.go`. The earlier >100-skills fix traverses pages, but a changed mastery/last evidence timestamp between separate queries can move a row across page boundaries. The same skill may be returned twice, inflating `TotalSkills`, `TotalEvidence` and score. A repository returning a row for a different path/explicit subject would likewise contaminate readiness.

## Narrow protection

- Keep the existing bounded 100-page traversal and the published readiness formula.
- Fail closed with the existing `ErrIncompleteReadiness` when a nonempty skill ID repeats within the same subject (including across pages), or a returned nonempty path/explicit subject conflicts with the requested scope.
- The same skill ID in different subjects remains distinct for a path-wide view.
- Preserve the existing tests that use minimal progress stubs with blank identifiers; real PostgreSQL rows always supply UUID identifiers.
- Tests: duplicate across pages; foreign path; foreign explicit subject; same ID in different subjects; existing >100/cap/empty/error cases.

**Limit:** This is a guard, **not a consistent snapshot**. A concurrent change can skip a row without causing a duplicate. Strong snapshot/aggregation at the repository layer and taxonomy denominator validation remain separate work; do not claim complete readiness parity or production consistency from this change.

**Gate:** Go unit/backend CI on exact PR SHA, database CI, frontend CI and E2E. If any fails, do not merge.
