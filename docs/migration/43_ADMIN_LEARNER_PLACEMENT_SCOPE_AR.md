# ADMIN-LEARNER-PLACEMENT-SCOPE-04 — read boundary checkpoint

**Source:** `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` (read only).
**Target base:** `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
**PR:** #179 (Draft, no merge/deploy).

## Scope and ownership

This is an independent Content/PostgreSQL consumer slice. PR #160 owns the separate Skills Center and lesson authoring/linking; #167/#170/#175 own their respective admin editor/list components. None of those files were changed. No header, school, student React, scoring, RBAC or payments files were changed.

The admin authoring service validates a course/lesson or topic/lesson link at placement time. Subsequent editing of the lesson/library item or parent course/topic can change its path/subject without deleting the placement. Before this change, learner queries checked workflow and visibility but not whether the placed child still belongs to its parent taxonomy. That allows a cross-subject item to appear in another subject's course/foundation workspace, and the lesson progress target resolver could still accept it.

## Implemented read-only consistency guard

- Course module lesson summaries: require child lesson `path_id` and `subject_id` to match the parent course.
- Course lesson detail: same parent-child taxonomy guard.
- Foundation topic lesson and library summaries: require child taxonomy to match the parent topic.
- Content-owned course/foundation progress target lookup: reject stale cross-subject placement, without changing learning scores or persistence.
- Existing published/visible/locked/preview constraints remain unchanged.

## Reproducible evidence

`internal/content/repository/postgres/learner_placement_scope_integration_test.go` creates a disposable schema in a disposable PostgreSQL service and inserts one valid placement and one intentionally stale cross-subject placement for course and foundation. It verifies valid content remains accessible, stale content is absent from summaries/detail, and stale progress targets are rejected. The new workflow `.github/workflows/content-placement-scope.yml` runs that test with `CONTENT_SCOPE_DB_TEST=1` and isolated `DATABASE_URL`.

RED commit: `bf90894f6dae603b3dda0028df5e5818bf6a288a` (test and workflow only; regression expected to fail before SQL fix).
Implementation commit: `7614196e2b249378f8f7cc3feb564983d73f33be`.
Formatting follow-up: `482c1f7fda9687c89db6e53191e0420c55657d36`.
Exact-head run results and final SHA must be recorded from GitHub, not inferred from this checkpoint.

## Acceptance matrix

| Contract | State until final CI |
| --- | --- |
| No cross-subject placement in course/topic summaries and lesson detail | PARTIAL — code + isolated DB test pending |
| No stale course/foundation lesson progress target | PARTIAL — isolated DB test pending |
| Valid same-subject placement remains visible | PARTIAL — isolated DB test pending |
| Four required CI gates on exact head | PARTIAL — pending |
| Admin UI parity with Legacy, 390/820/1440 paired screenshots | NOT PROVEN — no UI files changed |
| Real browser → Go → PostgreSQL → student reload | NOT PROVEN — separate end-to-end acceptance still required |

## Next handoff

1. Confirm the isolated PostgreSQL test and all four exact-head gates; retain RED logs.
2. With the admin and student owners, run the existing UI against the same disposable Go/PostgreSQL fixtures, save/change taxonomy, reload the student course/foundation and verify links. Do not write into either owner's branch.
3. Continue restoring original admin path/subject workspace and independent Skills Center through their existing PRs; no invented UI controls or reordered actions.
