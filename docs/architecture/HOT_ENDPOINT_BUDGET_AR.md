# ALMEAA V2 — Hot Endpoint Budget

هذه أرقام هندسية مبدئية وليست ادعاء Production. تُراجع بالقياس على Staging والـinstance الحقيقية.

## مبادئ القياس
لكل endpoint حرج نسجل:
- p50 / p95 / p99 latency.
- DB query count.
- rows returned.
- response bytes.
- cache hits/misses.
- CPU/memory عند load test.

## Identity

| Endpoint | DB Query Budget | Response Budget | ملاحظات |
|---|---:|---:|---|
| Login by email | <= 4 | <= 8 KB | indexed email + roles + failed-login clear + session insert |
| Login by national ID | <= 4 | <= 8 KB | indexed national ID |
| /auth/me | <= 3 | <= 8 KB | indexed session token + roles; bounded last_seen write |
| Logout | <= 2 | <= 2 KB | session lookup/CSRF then revoke |
| Forgot password | <= 3 | <= 2 KB | generic response; no existence leak |
| Reset password | <= 5 in one short transaction | <= 2 KB | token lock + user update + session revoke |
| Verify email | <= 4 in one short transaction | <= 8 KB | token lock + verify + user read |

## Question Bank — target before implementation
- default page <= 50-80 items.
- hard max <= 100.
- list response contains summary fields only.
- detail fetched separately.
- exact coverage counters not recomputed on every list request at high scale.
- question image bytes never pass through Go API.

## Assessment — target before implementation
- assessment start does not load historical attempts/results unrelated to current attempt.
- autosave writes only changed answer state.
- submit transaction bounded to one attempt/result; analytics side effects can use outbox/worker.
- result list summary separated from result detail/question review.

## Student Dashboard — target before implementation
- one bounded summary payload, not full catalogs.
- no question bank bootstrap.
- no raw assessment-answer history.
- independent lazy sections for expensive reports.

## Schools
- roster paginated.
- school/class scope resolved before large reads.
- reports use rollups/read models once raw-event scans become expensive.

## Smart Classroom
- websocket messages are deltas/events, not full session state every tick.
- live aggregates throttled/batched.
- durable PostgreSQL writes only for events required for report/audit.
- ephemeral presence in Redis with expiry.

## Acceptance thresholds before public staging
Initial goals to validate—not guarantees:
- ordinary API p95 under 300ms on representative staging load where no external provider is involved.
- no growing-list endpoint without a hard page limit.
- no endpoint with accidental N+1.
- no single normal JSON response above 250 KB without an explicit reason.
- no page initial load that downloads large media through the application server.
- database pool saturation remains below configured safety threshold during expected concurrency test.

Any endpoint exceeding its budget requires EXPLAIN/trace analysis before adding bigger infrastructure.
