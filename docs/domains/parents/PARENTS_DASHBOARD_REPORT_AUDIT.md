# Parents Dashboard / Weekly Report Audit

Status: **TESTED / MERGED**

## Source contract
The Product Blueprint defines the Parent as an observer, not an Assessment taker by default. The core capability is:
- active linked students only.
- simplified result/progress.
- weak skills and one next action.
- weekly report.
- no content or Assessment authoring.

The acceptance golden journey is:
`linked student only -> result/progress -> weekly report`.

Organizations is already the canonical owner of `parent_student_relationships`. The Parents boundary may be a facade, but it must not perform unrestricted user reads or duplicate source-domain state.

Legacy evidence confirms:
- parent progress reads canonical authorized student IDs.
- child progress is fetched in bounded/batched reads rather than one query per child.
- weekly summaries use Assessment time/results and weak-skill summaries.
- canonical relationship rows must remain authoritative; stale legacy arrays must not reopen revoked access.

## Ownership
Parents owns orchestration and parent-facing DTOs only.

It composes narrow reads from:
- Organizations: canonical active parent -> student authority.
- Identity: name/avatar only for already-authorized student IDs.
- Assessment: result summaries and seven-day assessment aggregates.
- Learning: current weak-skill and deterministic recommended-action projections.

Parents does not join those domains' tables directly.

## Endpoints
### `GET /api/v1/parents/authority`
Preserves the existing canonical authority facade.

### `GET /api/v1/parents/dashboard?page=&limit=`
Returns a bounded page of linked children with:
- safe student identity (name/avatar only).
- Assessment count, average score and assessment time for the rolling previous seven days.
- up to three recent Assessment result summaries for the dashboard.
- up to five current Learning skills below the canonical good threshold (75).
- the first canonical Learning `recommended_action` as the next action.

### `GET /api/v1/parents/children/{studentId}/results?page=&limit=`
Rechecks the canonical parent relationship before the Assessment reader is called. Returns bounded result summaries only.

It never returns:
- assessment answers.
- correct-option keys.
- review/explanation payload.
- student email, phone or national ID.

### `GET /api/v1/parents/weekly-report?page=&limit=`
Read-only rolling seven-day report. It returns trusted Assessment aggregates plus up to three current weak skills and the current deterministic Learning next action.

Delivery is not performed here.

## Frontend
`/parent-dashboard` is no longer a placeholder.

The responsive parent screen provides:
- linked-children overview.
- seven-day assessment count/average.
- concise per-child recent result.
- weak-skill priorities.
- deterministic next action.
- child result list.
- weekly read-only report.
- explicit empty state for no active linked relationship.

## Authorization and privacy
- Parent role is required for every endpoint.
- Parent relationship authority is resolved before any child source-domain read.
- direct result lookup for an unlinked student is denied before Assessment access.
- revoked/inactive relationships are absent from the canonical Organizations projection.
- child IDs are deduplicated before pagination and foreign readers receive only the selected bounded IDs.
- no parent endpoint can start/submit an Assessment or mutate Learning state.

## Deliberate exclusions
This slice does not invent or silently migrate:
- self-service student linking/consent codes.
- parent payment approval semantics.
- WhatsApp/email delivery settings.
- weekly report scheduling/delivery.
- notification templates/campaigns.
- parent writes into student learning state.

The Blueprint places weekly report delivery/WhatsApp with Communication/Notifications, so Parents exposes the report data while delivery remains the next domain phase.

## Performance boundary
- Parent dashboard defaults to 20 children and caps at 50.
- Assessment recent rows are capped per selected child.
- Learning weak-skill rows are capped per selected child using a windowed batch query.
- no N+1 child loop performs repository reads.

## Verification checkpoint
- PR #63 merged from exact tested head `cfcc0bf24caa55c52266fcc75c5c0dc31f4c0a95`.
- squash merge commit: `0fc4d5d4962e01ca81c844eb153a8c0235103260`.
- Database CI `36261272111`: PASS — all migrations applied, canonical parent relationship table/indexes verified, every migration rolled back and re-applied.
- Backend CI `36261272140`: PASS — module lock/sqlc/gofmt/vet/tests including canonical-authority negative coverage.
- Frontend CI `36261272127`: PASS — typecheck/build.
- Frontend E2E `36261272112`: PASS — all 34 browser tests including parent mobile linked-child golden journey and explicit no-link empty state.
- browser evidence artifact `content-browser-evidence` id `10912034166`, digest `sha256:55ae07b373810ef3e3a04fce7e18cc94b90d16c484b61dee8d81806b57b4e127`.
- initial Backend failures were gofmt-only; the initial Parent E2E failure was an ambiguous semantic locator. Both were corrected without weakening authorization or product behavior, then all four exact-head gates passed.
