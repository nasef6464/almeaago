# ADMIN-TAXONOMY-PARENT-CYCLE — isolated integration checkpoint

Date: 2026-10-29. Legacy source (read-only): `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`. Go base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.

## Owner and non-overlap

This PR owns only the Go taxonomy repository's **path parent integrity** and its new isolated PostgreSQL regression test/workflow. The Skills Center / taxonomy UI / lesson CRUD remain exclusively with draft PR #160. No header, student, school, scoring, payment, authorization policy, migration, production or Legacy writes.

## Proven source-code gap

`internal/taxonomy/repository/postgres/mutations.go::UpdatePath` directly accepted any foreign-key-valid `parent_path_id`; `migrations/000010_taxonomy_foundation.up.sql` rejects only a direct self-parent, not a multi-node cycle. Admin can update A's parent to C when A→B→C, creating a cycle. Concurrent A→D and D→A can also both pass an unlocked ancestry check. The public bootstrap orders by sort order and reads the same `parentPathId`, so a cyclic tree cannot represent the original hierarchy reliably.

## Slice contract

Actor: platform admin → existing taxonomy path edit → PATCH `/api/v1/taxonomy/admin/paths/{id}` → `taxonomy/application.Service.UpdatePath` (existing role/CSRF checks unchanged) → `taxonomy/repository/postgres.Repository.UpdatePath` → `paths.parent_path_id` and audit → admin bootstrap / consumer.

- Reject descendant and self parents with the existing `taxonomy.ErrConflict` / HTTP 409 contract.
- Serialize non-empty parent-changing writes using a transaction-scoped PostgreSQL advisory lock before recursive ancestry validation; never commit a cycle under two concurrent reparent operations.
- Preserve valid parent moves and clearing a parent, stable IDs and codes, no extra UI elements or changed RBAC.
- Roll back failed mutations and write audit only on success.
- New `TestAdminPathParentCyclePostgres` uses a **disposable schema**, no production data. Dedicated workflow executes an expected-failure RED using the original Go main repository code and the exact same test, followed by GREEN on this PR.
- This fixes a bounded hierarchy integrity issue, **not** a proof that original path/subject workspace UI matches Legacy.

## Evidence and remaining acceptance

PR: #183 (Draft). CI: Backend, Frontend, Database, Browser plus dedicated Taxonomy Path Cycle PostgreSQL must be checked on the **final commit SHA**. The dedicated workflow is the only new real PostgreSQL test; the four existing gates alone do not prove this new behavior. No paired Legacy↔Go screenshots at 390/820/1440 are supplied by this backend-only slice.

Pending: PR #160 owner must restore original independent Skills Center and original path/subject screen ordering and controls; pair screenshots using the same role/data; test create/edit failed-save draft retention, back/reload, and learner visibility using real Go/PostgreSQL. No duplication or edits to PR #160 files. All UI parity remains PARTIAL / NOT PROVEN.
