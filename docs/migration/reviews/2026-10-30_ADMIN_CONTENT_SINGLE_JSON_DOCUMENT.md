# Admin content mutations: single JSON document — 2026-10-30

## Scope and ownership

- Source read-only: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Target baseline: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- This is a transport integrity correction in `internal/content/transport/http/handler.go`, **not** a UI redesign or a parity certificate.
- Files in PR #160 (Skills Center, lessons, admin shell), #159 (header), #161/#163 (student) and other owned frontend branches remain untouched.
- No production, legacy, schema, RBAC, scoring, payment, or deployment write.

## Proven failure (RED)

A shared `contenthttp.decodeJSON` consumed only the first JSON value. It returned success on bodies like `{"title":"درس"} {"title":"آخر"}` or `{"title":"درس"} !`. Consequently, content mutation handlers could invoke their services without validating the full request body.

- Test-first SHA: `3094efd646df078d73c9bdfd0930c40b763a706e`.
- [Backend RED run](https://github.com/nasef6464/almeaago/actions/runs/40996883626) failed at `go test ./...` with **five** expected cases: two objects, trailing null, array, scalar, and garbage. `gofmt`, `go vet` and compilation passed. Earlier test commit `bf9940d` failed `gofmt` and is **not** counted as behavioral RED.
- Valid single JSON, trailing whitespace, Arabic text, unknown fields, invalid first document and empty-body cases are in the regression table.

## Minimal correction

After the first strict decode, the decoder must reach `io.EOF` on the second decode; a second value or malformed suffix returns HTTP 400 **before** the service call. Preserve the 256 KiB request cap, unknown-field rejection, authentication/CSRF ordering and existing error envelope.

A second test table covers eight real HTTP mutation routes without a backing service: create course, create lesson, create library item, create foundation topic, set trainer scope, create course module, link foundation lesson and course publication. For invalid trailing documents, each must return HTTP 400 before reaching a service.

## Acceptance boundary

- **VERIFIED only after exact-head CI:** Go regression suite, frontend typecheck/build, database workflow and browser workflow on the final PR SHA. Workflow green is scoped to this correction, not to complete admin/learner parity.
- **NOT PROVEN:** actual PostgreSQL write/reload and learner visibility, original admin dashboard/independent Skills Center parity, and paired Legacy↔Go 390/820/1440 RTL screenshots.
- **Next:** owner of PR #160 completes original admin layout, counters and independent skills controls; owner of PR #199 resolves failed-save draft retention; learner owner proves admin edit → Go/PostgreSQL → learner reload without touching this transport branch.
