# AI Question Assistant Foundation Audit

Status: **IMPLEMENTED — CI REQUIRED BEFORE MERGE**

## Source-backed scope
The Product Blueprint treats AI as its own domain rather than scattered provider calls. The first deterministic V2 slice implements the documented golden path:

`provider health -> admin routing policy -> Question Assistant -> deterministic cache -> bounded policy -> provider failure fallback`.

The assistant is advisory. Assessment owns scoring, Learning owns mastery/review truth, Question Bank owns question/version content, and Identity owns the authenticated actor.

## Provider abstraction
Supported source-backed provider IDs:
- Gemini.
- OpenRouter.
- Qwen.
- DeepSeek.
- OpenAI.
- Ollama.
- LM Studio.

`ai_provider_settings` owns non-secret routing policy:
- enabled/disabled.
- model.
- approved external base URL.
- priority.
- max output tokens.
- optimistic revision.

All providers are seeded disabled.

External API keys remain server deployment secrets:
- `GEMINI_API_KEY`.
- `OPENROUTER_API_KEY`.
- `QWEN_API_KEY`.
- `DEEPSEEK_API_KEY`.
- `OPENAI_API_KEY`.

Local runtime endpoints for Ollama/LM Studio remain deployment-owned environment configuration. The browser/admin API never receives or writes API keys.

External provider base URLs are restricted to the known source-backed provider host/path. An admin cannot turn the AI server into an arbitrary outbound HTTP proxy.

## Runtime policy
Source-backed runtime settings:
- `AI_REQUEST_TIMEOUT_MS`: default 15000, bounded 1000..60000.
- `AI_QUESTION_ASSISTANT_PER_MINUTE`: default 8, bounded 1..60.
- `AI_QUESTION_ASSISTANT_CACHE_MINUTES`: default 30, bounded 1..1440.
- `AI_INTERACTION_RETENTION_DAYS`: default 30, bounded 1..365.

Per-provider output tokens are an audited database policy. The current application accepts 64..2000 output tokens for a provider route.

## Circuit breaker and fallback
Provider routing follows ascending persisted priority.

A provider is skipped when:
- disabled.
- server credential/runtime is absent.
- its circuit is still open.

Failure state is persisted in `ai_provider_health`.
- success resets consecutive failures and closes the circuit.
- the third consecutive failure opens the circuit for one minute.
- a later successful call resets health.

If no enabled provider succeeds, Question Assistant returns deterministic trusted Question Bank help rather than pretending a provider response succeeded.

Provider errors stored in telemetry are bounded categories. External error response bodies and secrets are not copied into the learner response.

## Question Assistant authorization
`POST /api/v1/ai/question-assistant` is:
- student-only.
- CSRF protected.
- scoped to one canonical learner-owned Learning `ReviewCard`.
- pinned to the exact `question_id + question_version` on that card.

The service refuses a foreign/nonexistent ReviewCard before any provider call.

It reads one exact Question Bank review projection and builds bounded context from:
- question ID/version.
- question text.
- option text.
- trusted hint.
- trusted solving strategy.
- trusted explanation.
- selected help level.
- at most 500 characters of learner follow-up text.

It does **not** send:
- the full Question Bank.
- the full Assessment.
- the learner's full history/profile.
- Commerce/parent/school records.
- scoring/mastery state as provider-owned truth.

The server-owned correct-option field is never serialized into the AI prompt.

## Progressive help levels
The source-backed Question Assistant levels implemented are:
- `hint`.
- `stronger_hint`.
- `concept`.
- `steps`.
- `follow_up`.

The React Review Library exposes these progressively on each canonical ReviewCard while keeping the canonical ReviewCard/Question boundaries.

## Cache and duplicate suppression
The cache key is SHA-256 over:
- user ID.
- ReviewCard ID.
- exact question/version.
- help level.
- normalized learner message.
- prompt version `question_tutor.v1`.

Identical unexpired requests are served from `ai_question_assist_cache` before the provider-call budget is evaluated.

An in-process singleflight map suppresses simultaneous identical generation within one API process. The persistent cache provides cross-request reuse after the first completed call.

Normal provider responses use the configured cache TTL. Deterministic fallback responses use at most two minutes so provider recovery is not hidden for long.

The cache deliberately stores the bounded assistant response because it is the reusable product result. Expired rows are ignored. Physical expired-row purge is a separate operations/retention job and is not falsely claimed here.

## Per-minute policy
Before a non-cached generation, the service counts recent non-cache Question Assistant interactions for the authenticated learner.

At the configured limit:
- no provider call occurs.
- a trusted deterministic fallback is returned.
- the policy event is recorded as `rate_limited`.
- rate-limit fallback rows do not recursively increase the provider-call count.

This is a provider-cost/abuse guard, not an Assessment or mastery rule.

## Interaction ledger
`ai_interactions` stores bounded operational evidence:
- actor/resource IDs.
- audience/endpoint/capability.
- provider/model.
- success/fallback/error.
- cache/fallback flags.
- latency.
- token counts and whether estimated.
- response length.
- bounded error category.
- prompt version.
- bounded metadata.
- retention timestamp.

It does not store full prompts, learner messages, or full generated response text.

## Admin UI
`/admin-dashboard/ai` provides:
- provider enable/order/model/token policy.
- whether the deployment runtime is configured.
- circuit/failure status.
- fixed provider health test.
- bounded interaction ledger.

The UI cannot edit or reveal credentials.

## Learner UI
Review Library includes a responsive Question Assistant panel:
- one owned ReviewCard at a time.
- progressive help buttons.
- optional short follow-up.
- explicit indication of provider response vs trusted fallback.
- cache indication.

The request payload contains only `reviewCardId`, `helpLevel`, and learner `message`. Question context is resolved server-side.

## Deliberate exclusions
This slice does not invent or overclaim:
- live provider credential proof in CI.
- encrypted browser-managed provider secret storage.
- vision/image-byte analysis.
- audio/voice tutor.
- AI question authoring/generation workflow.
- automatic Study Plan generation.
- readiness/weakness prediction beyond existing deterministic Learning policy.
- automated scoring or mastery mutation.
- provider pricing/cost estimates without a maintained pricing contract.
- distributed singleflight across multiple API replicas.
- physical retention purge of expired cache/interaction rows.

Those remain explicit provider/deployment or later-domain work.

## Required gates
- Database migration apply + AI table/index/constraint verification + complete rollback + re-apply.
- Backend module lock + sqlc compile + gofmt + go vet + all Go tests including ownership, URL guard, provider fail-closed, fallback/cache, circuit and rate policy.
- Frontend typecheck + production build.
- Playwright admin provider-policy/test flow + learner mobile Question Assistant flow + complete existing browser suite.
