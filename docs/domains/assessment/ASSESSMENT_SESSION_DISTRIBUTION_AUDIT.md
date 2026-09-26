# Assessment Session Distribution Audit

Status: **IN REVIEW**

## Scope
This slice closes Assessment's remaining HTTP/product-entry distribution surface:
- public link.
- barcode/QR payload link.
- authenticated live Assessment session.

It does **not** implement Smart Classroom websocket presence, question push/reveal, projector state or live aggregates; those remain Realtime-owned.

## Canonical ownership
Assessment owns:
- Session channel/status/window/code.
- exact pinned Assessment version.
- public anonymous Assessment attempt/result records.
- live Assessment attempt context.

Question Bank remains canonical for question/version/options/correctness data.

## Anonymous public/barcode model
The legacy product explicitly supported opening a barcode test without login and entering name/school/class.

V2 therefore does not fabricate Guest Users and does not attach anonymous public outcomes to a student account.

Migration `000021_assessment_session_distribution` adds:
- `assessment_public_attempts`.
- `assessment_public_answers`.
- `assessment_public_results`.

All answer rows reference exact `assessment_version_questions` and `question_options`; no question payload is copied.

## Public security/integrity
- anonymous participant key is stored only as SHA-256 bytes.
- start/submission keys are bounded and unique for retry safety.
- attempt count is enforced per Session + participant hash.
- time limit and Session close time are enforced server-side.
- Session must be active and inside the server-owned open/close window.
- answer keys/explanations are never returned by public start.
- submitted options are validated against the exact Question version.
- scoring is server-owned and points-weighted.
- result visibility follows `show_results_report`.
- optional `max_submissions` bounds a public campaign/room.
- answer insert is one JSON-to-relational SQL batch; no per-question DB round trip.

## Live Assessment entry
- requires authenticated Student.
- Session channel must be `live`, active and inside its window.
- school/class-scoped sessions require current active membership.
- start is CSRF-protected/idempotent.
- canonical `assessment_attempts.session_id` is used.
- per-Session max attempts come from the pinned Assessment version.
- the existing Attempt runner handles save/resume/submit/result.

## Staff
- current Assessment Center authoring surface is admin/authorized teacher.
- create/list/status are scoped through Assessment ownership/assignment and optional organization scope.
- unsafe mutations require CSRF.
- a Session is created as `scheduled`; activation is explicit.
- lists are bounded to 100 and use `limit+1/hasMore`.

## UI / E2E target
- staff creates and activates a barcode Session and obtains its stable public path.
- anonymous mobile participant starts without authentication, answers and submits, seeing only server-returned result policy.
- authenticated mobile Student joins a Live Session by code and enters the canonical Attempt runner.

## Deferred boundaries
- QR image rendering/printing polish may be added in later visual parity work; the stable QR payload URL is canonical in this slice.
- Smart Classroom realtime state is Realtime.
- entitlement is Commerce.
- mastery/evidence is Learning.
- public-to-account identity claiming is a separate explicit product flow, not implicit matching by name/contact.
