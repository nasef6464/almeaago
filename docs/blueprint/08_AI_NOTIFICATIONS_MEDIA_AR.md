# 08 — AI, Notifications, Media & Integrations

## 1. AI Domain

Current repository already has AI-specific:
- admin manager.
- provider status/testing.
- interaction logs.
- student target authorization.
- circuit breaker.
- question assistant.
- readiness/remediation APIs.
- platform integration settings.

Target AI must remain a Domain, not scattered provider calls.

## 2. AI Provider abstraction

Required interfaces:
- Provider ID/model.
- health/status.
- generate text/structured output.
- optional vision.
- optional audio/live.
- timeout.
- circuit breaker.
- retry/fallback.
- cost/token reporting.

Current docs/code show admin/provider ordering and fallback concepts. Exact active credentials/providers are deployment state and must be revalidated rather than hardcoded into product spec.

## 3. AI Admin

Admin can:
- configure integrations/keys through secured integration settings.
- see source/status.
- test provider.
- set/follow fallback order.
- view interactions/monitoring.
- use admin assistant for diagnostics.

Secrets encrypted at rest where current integration layer supports it; target keeps secret manager/encryption boundary.

## 4. Student AI / Question Assistant

Input should be minimal:
- question ID.
- trusted question text/AI context.
- skill/fingerprint.
- learner request.
- bounded current context.

Do NOT send:
- entire question bank.
- full test.
- full student history.
- image bytes by default.

## 5. Question AI Context

Precomputed fields reduce repeated AI work:
- readableText.
- speechText.
- visualDescription.
- optionTexts.
- math expressions + spoken Arabic.
- concepts.
- required data.

Use trusted explanation/hint/strategy before generating from scratch.

## 6. Voice

Question can store:
- voice explanation text.
- audio URL.
- MIME type.
- version.

Audio asset uploads direct to R2 via presigned URL.

Live AI tutor is INTENDED/partial product direction:
- text + voice.
- Socratic/hint progression.
- policy aware.
- no answer leak during active exam.
- readiness/prediction outputs must identify model/data limitations.

## 7. AI Token Cost Controls

- Cache deterministic explanation by question/version/prompt version.
- Deduplicate concurrent identical requests.
- token caps.
- smaller model for routine extraction/formatting.
- expensive model only for hard cases.
- Vision only if preprocessed context insufficient.
- store usage ledger by feature/provider/model.
- TTL/retention for verbose interaction logs.
- never call LLM on every question render.

## 8. Notifications

Current channels foundation:
- in-app.
- email.
- WhatsApp.
- provider adapters.
- delivery records.
- templates/variables.
- campaign send.
- queue/retry.

Delivery states:
- pending.
- sent.
- retrying.
- failed.

## 9. Notification Queue

Do not send thousands inside request.

Flow:
```
Campaign
 -> Delivery rows
 -> enqueue external channels
 -> worker
 -> provider
 -> retry/backoff
 -> final status
```

Redis/BullMQ current direction, target can keep equivalent queue abstraction.

## 10. Audience security

Notification audience resolved server-side:
- users.
- roles/scopes.
- school/classes.
- linked parents.
- explicit caps.

No arbitrary client-provided emails/phones bypassing authority.

## 11. Media Domain

Current direct upload supports:
- question images.
- question import images.
- explanation audio.

R2 responsibilities:
- large binaries.
- immutable/hash-addressed media where practical.
- CDN delivery.

App DB responsibilities:
- asset ID.
- owner/reference.
- URL/object key.
- MIME.
- size.
- checksum/hash.
- version.
- created/status.

## 12. Why media is not in application DB

To reduce:
- DB size.
- backup size.
- API bandwidth.
- memory use.
- duplicated quiz/review assets.
- deployment coupling.

## 13. Presigned upload

Backend only authorizes/creates short-lived signed PUT.
Browser/client uploads directly.
Server validates final metadata/reference when saving business object.

Limits:
- allowed MIME.
- size.
- expiry.
- authenticated permission.

## 14. CDN caching

Target production:
- custom domain.
- cache hashed immutable files aggressively.
- lazy-load.
- responsive dimensions/thumbnails if needed.
- purge/version strategy for mutable aliases.

## 15. Integrations

Platform integrations are configuration, not business logic.
Each integration:
- enabled/status.
- secret fields.
- public fields.
- source/config version.
- health test.
- audit history.

No secret returned to browser in plaintext.

## 16. Observability

For AI/media/notification:
- request ID.
- provider.
- latency.
- failure category.
- retries.
- bytes/tokens.
- cache hit.
- cost if available.
- no sensitive payload logging by default.
