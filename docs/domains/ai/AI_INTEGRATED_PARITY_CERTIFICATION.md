# AI Integrated Parity Certification

Status: **CERTIFICATION CANDIDATE**

## Source basis
Re-audited against:
- current V2 `main` at the start of this batch: `ec0dc9bdfc02b96de4acb0f3facbbbebb1465890`;
- latest read-only legacy checkpoint `95e8cb7399431da481a0d69ef3420a16bbb8c66c`;
- V2 Blueprint AI/Admin contracts, especially `08_AI_NOTIFICATIONS_MEDIA_AR.md` and `17_UI_SCREEN_WORKFLOW_MAP_AR.md`;
- legacy AI operating/execution contracts and their AI-1/AI-2/AI-4 runtime evidence.

The V2 contract requires an AI domain, provider health/fallback, Question Assistant, token/cost controls, interaction observability, AI Admin readiness/provider test/logs and a diagnostic admin assistant. Voice/live tutor remains intended/partial product direction; exact credentials are deployment state.

## Existing trusted V2 foundation
The merged AI foundation already provides:
- server-only provider adapters for Gemini/OpenRouter/Qwen/DeepSeek/OpenAI/Ollama/LM Studio;
- admin non-secret provider enable/model/priority/output-token policy;
- fixed provider health test and persisted circuit state;
- student-only, CSRF-protected Question Tutor over one owned Learning ReviewCard and exact Question Bank version;
- no correct-option field in the provider prompt;
- deterministic trusted fallback;
- persistent cache + in-process singleflight;
- per-minute learner provider-call guard;
- bounded interaction ledger with provider/model/token/latency/fallback/error evidence;
- no AI mutation of Assessment scoring, Learning mastery, Review truth or Study Plans.

## Source-backed parity additions

### Explicit local-provider runtime truth
Legacy production audit identified false-ready local providers caused by default localhost URLs. V2 now requires explicit `OLLAMA_BASE_URL` / `LMSTUDIO_BASE_URL` configuration. Models may retain harmless defaults, but a local provider is not reported configured unless its endpoint is explicitly supplied by deployment.

This prevents an admin from seeing a local runtime as available merely because the application has a conventional localhost default.

### Indexed daily usage budgets
A normalized `ai_usage_daily` table records UTC daily rollups by:
- global scope;
- user scope;
- capability scope.

Each billable provider-generation attempt updates request count, input/output/total/cached tokens, fallback count and error count in the same PostgreSQL transaction as the interaction ledger row.

Non-billable rows do not consume the daily budget:
- cache hits;
- per-minute rate-limit fallback;
- daily-budget fallback.

Source-backed daily guards:
- `AI_DAILY_LIMIT` default 800.
- `AI_PER_USER_DAILY_LIMIT` default 80.

Question Tutor evaluates persistent cache before budgets. A daily-limit hit produces trusted deterministic help rather than an external provider call.

### AI Admin readiness and usage observability
New admin read models expose:
- requests/tokens today;
- last-24h fallback/error/cache-hit counts;
- 24h token totals;
- provider request/token/fallback/error/latency summaries;
- enabled vs explicitly configured providers;
- open circuits;
- daily budget position.

Readiness distinguishes:
- `ready`;
- `degraded`;
- `fallback_only`.

`Runtime configured` is explicitly not treated as live-provider certification.

### Read-only Admin Copilot
The Blueprint's verified AI Admin workflow includes an assistant prompt for diagnostics. V2 now supplies a CSRF-protected platform-admin-only copilot that composes only bounded facts from:
- AI readiness/usage;
- Operations readiness;
- PostgreSQL/Redis dependency status;
- bounded failure/live-classroom counts;
- integration configured booleans;
- backup/restore evidence state.

It:
- runs through the same provider chain and daily budget guard;
- falls back to a deterministic diagnostic when no provider succeeds or budget is exhausted;
- never executes an administrative action;
- does not ingest provider secrets or raw audit payloads;
- records bounded interaction evidence under capability `admin_copilot`.

## Ownership and safety boundaries
- Operations owns release/dependency/readiness truth.
- AI may explain Operations facts but cannot alter them.
- Learning/Question Bank continue to own ReviewCard/question truth.
- Assessment/Learning deterministic scoring/mastery/readiness remain non-LLM.
- Provider credentials remain deployment/server-owned.
- PostgreSQL is authoritative for detailed AI ledger and daily rollups.

## Explicit external/deferred evidence
This certification does **not** claim:
- a live external provider succeeded in staging/production;
- multi-key/quota-pool secret management parity where V2 has no approved secret-store contract;
- provider cost estimates without a maintained pricing contract;
- live Voice Tutor or paid STT/TTS parity;
- image-byte Vision parity beyond the Blueprint's intended/optional direction;
- a Qiyas predicted score without calibration evidence;
- physical purge/retention execution beyond the existing retention timestamps;
- production concurrency/load/cost evidence.

Those stay external/deferred instead of being inferred from CI.

## Closure gate
The final documentation-inclusive head must pass Database CI, Backend CI, Frontend CI and Frontend E2E on the exact same SHA. Browser evidence must cover the AI Admin readiness/usage/copilot surface and the learner Question Tutor privacy/fallback path. Latest legacy must be re-checked for a same-domain delta immediately before merge.

Status remains **TESTED**, not `PARITY_PROVEN`, until the complete release-evidence contract is satisfied.
