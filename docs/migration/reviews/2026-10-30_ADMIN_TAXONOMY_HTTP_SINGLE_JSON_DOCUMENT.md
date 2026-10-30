# Admin taxonomy HTTP mutation body integrity — 2026-10-30

## Scope and authority

- Legacy read-only main: `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go baseline main: `98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Independent Draft PR #210, branch `fix/admin-taxonomy-strict-json-20261030-run3`.
- Exact files: `internal/taxonomy/transport/http/handler.go` and `strict_json_test.go`.
- No edits to #160 (skills/lessons/admin UI), #199 (503 draft tests), #206 (original skills controls tests), #202 (taxonomy PostgreSQL scope), or any header/learner/school files.

## Reproducible defect and correction

The shared `decodeJSON` used by the authenticated admin path, level, subject and skill create/update endpoints decoded only the first JSON value and returned success without checking for trailing content. For example `{"name":"مسار"} {"name":"آخر"}` was accepted as a valid body at the decoding boundary. This is a **source-code-proven HTTP input-integrity defect**, not a claim about Legacy visual parity or a production exploit.

The focused regression checks a single object, whitespace, two objects, a second `null`, malformed trailing JSON, and unknown fields. The implementation performs a second decoder read and requires `io.EOF` before allowing the mutation to proceed. All malformed/trailing inputs return HTTP 400; existing auth/CSRF and service/domain decisions remain untouched. No automatic retry, new UI control, or data migration.

Trace: manager save action → authenticated `POST/PATCH /api/v1/taxonomy/admin/{paths,levels,subjects,skills}` → shared HTTP JSON decoder → existing taxonomy application validation → existing PostgreSQL mutation repository → public/learner consumers. The test verifies the decoder leg only. The full save/reload/learner effect still requires the owner integration test.

## Evidence / acceptance

- RED commit (test only): `60a494b3a358b94ede9c733b178c26e5f5b0d9fb`. It introduces trailing-value assertions which the original decoder fails by inspection; **do not call it a CI-observed RED without an exact-head run**.
- Fix commit: `4b0f73dbd1768d2b8f77e484e00f0368c83b2c8c`.
- Local or CI test command: `go test ./internal/taxonomy/transport/http -run '^TestTaxonomyMutationJSONSingleDocument$' -count=1 -v`.
- Four CI gates: record results from the **final documentation-inclusive SHA**, not from the earlier test-only or fix commit.
- VERIFIED after Go test GREEN: one-document decoding and 400 on trailing values.
- PARTIAL: full admin UI → HTTP → Go → PostgreSQL → learner route, original order/buttons, 503 draft retention, visual parity.
- BLOCKED: #160 owns the admin UI and Skills Center; #199 has nine RED failed-save tests; #206 has nine RED original-controls tests. Do not duplicate or bypass their file ownership.
- NOT PROVEN: paired Legacy↔Go screenshots at 390/820/1440 RTL, and a real session with same role/data.

## Owner handoff

#160: preserve the standalone Skills Center, original six counters, question count and original controls; no destructive delete without approved dependency/authorization contract. On taxonomy 503, keep the create/edit draft and dialog, show failure, permit explicit manual retry, and prove persisted result on reload. Student owner: verify manager level/subject changes reach learner scope using canonical API; do not write the student branch here. #202 must independently finish its PostgreSQL visibility contract. No merge, deploy, production/Legacy writes, scoring, payments or RBAC changes.
