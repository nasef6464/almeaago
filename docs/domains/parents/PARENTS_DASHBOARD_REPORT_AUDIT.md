# Parents Dashboard / Weekly Report Audit

Status: **IMPLEMENTED — CI REQUIRED BEFORE MERGE**

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

## Required gates
- Database migrations apply/schema verification/rollback/re-apply.
- Backend module lock/sqlc/gofmt/vet/tests including parent canonical-authority negative tests.
- Frontend typecheck/build.
- Playwright parent mobile golden journey and empty-state regression plus all existing browser journeys.
