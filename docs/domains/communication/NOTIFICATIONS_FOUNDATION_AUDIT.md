# Communication / Notifications Foundation Audit

Status: **TESTED / MERGED**

## Source-backed contract
The current product sources define Communication/Notifications as the owner of:
- notification templates.
- campaigns.
- delivery records.
- in-app, email and WhatsApp channels.
- bounded audience resolution.
- queued external delivery with retry/final state evidence.

The legacy implementation also establishes:
- delivery states: `pending | sent | retrying | failed`.
- in-app delivery is immediately `sent` through the internal channel.
- email/WhatsApp delivery is created as `pending` and processed outside campaign creation.
- provider modes: console, Resend, generic email HTTP, WhatsApp Cloud and generic WhatsApp HTTP.
- four external attempts with exponential queue backoff.
- message variables use `{{name}}` syntax and an absent variable renders as an empty string.
- an unconfigured provider must not be reported as sent.

## Ownership
Communication owns:
- `notification_templates`.
- `notification_campaigns`.
- `notification_deliveries`.
- template rendering.
- campaign orchestration.
- delivery retry state.
- provider adapters.

Identity owns user identity/contact/role truth. Communication resolves a narrow active-recipient projection through Identity and never queries `users` or `user_roles` directly.

Operations receives audit events for privileged template and campaign mutations.

## Data model
Migration `000035_notification_foundation` adds normalized:
- templates with unique stable key, channel, variables, active state and optimistic revision.
- campaigns with rendered message/channel snapshots and recipient/delivery counts.
- one delivery per campaign + user + channel with recipient contact snapshot required by the external provider path.
- inbox, unread, worker, campaign and admin indexes.

No delivery arrays are embedded in User records.

## Audience safety
The first V2 campaign slice supports:
- explicit user IDs.
- canonical Identity roles.

Rules:
- only active users are returned by Identity.
- user/role selections are de-duplicated server-side.
- audience is resolved before any delivery rows are written.
- the current hard cap is 500 resolved recipients.
- 501 or more recipients fails closed; no silent truncation and no partial campaign is created.
- arbitrary client email/phone addresses are not accepted as audience authority.

The legacy system later introduced a separate 10,000-recipient keyset-paged campaign orchestration. V2 intentionally keeps the smaller 500-recipient foundation cap until a dedicated large-campaign fan-out slice is justified and tested.

## Templates
Admin template write requires:
- key: 2–80, `[A-Za-z0-9_.-]`.
- name/title/body bounds.
- channel: `in_app | email | whatsapp`.
- max 50 unique variable names.
- optimistic `expectedRevision`.

A template selected for sending must be active.

Message rendering:
- explicit title/subject/body override the template where supplied.
- subject falls back to title.
- values are limited to JSON scalar string/number/bool/null.
- unknown/missing placeholders render empty, matching the verified legacy behavior.

## Campaign creation
`POST /api/v1/notifications/admin/send`:
- platform admin only.
- CSRF protected.
- resolves trusted recipients through Identity.
- persists campaign and all delivery rows transactionally.
- writes one Operations audit event.
- does not call email/WhatsApp providers inside the HTTP request.

For `in_app`:
- status starts `sent`.
- provider is `internal`.
- `sent_at` is recorded immediately.

For `email` / `whatsapp`:
- status starts `pending`.
- worker processing is required.

## Inbox
Authenticated users receive only their own in-app `sent` rows through:
- `GET /api/v1/notifications/me`.
- `GET /api/v1/notifications/me/unread-count`.
- `PATCH /api/v1/notifications/{deliveryId}/read`.
- `PATCH /api/v1/notifications/me/read-all`.

Read mutations are CSRF protected in V2. A delivery belonging to another user is not returned by the scoped update/read path.

Recipient email/phone snapshots are stripped from the self-inbox DTO.

## Worker and retry
`cmd/worker` now performs the external delivery loop.

The repository claims a bounded batch with PostgreSQL `FOR UPDATE SKIP LOCKED` and a five-minute lease. This avoids duplicate concurrent worker claims without introducing Kafka or a second durable queue truth.

Retry:
- max four attempts.
- failure 1 -> retry after 1 minute.
- failure 2 -> retry after 2 minutes.
- failure 3 -> retry after 4 minutes.
- failure 4 -> final `failed`.
- success -> `sent`, provider/provider message ID and timestamp recorded.

Worker batch default: 25, max 50.
Worker poll default: 5 seconds.

## Providers
Source-backed provider modes implemented:

Email:
- `console` test adapter.
- `resend`.
- generic `http` webhook.

WhatsApp:
- `console` test adapter.
- `whatsapp_cloud`.
- generic `http` webhook.

Configuration read by the worker:
- `NOTIFICATION_WORKER_BATCH`.
- `NOTIFICATION_WORKER_POLL_SECONDS`.
- `EMAIL_PROVIDER`.
- `EMAIL_FROM`.
- `RESEND_API_KEY`.
- `EMAIL_WEBHOOK_URL`.
- `EMAIL_WEBHOOK_TOKEN`.
- `WHATSAPP_PROVIDER`.
- `WHATSAPP_ACCESS_TOKEN`.
- `WHATSAPP_PHONE_NUMBER_ID`.
- `WHATSAPP_WEBHOOK_URL`.
- `WHATSAPP_WEBHOOK_TOKEN`.

Empty/missing provider configuration fails closed and enters retry/failure state; it never fabricates a successful send.

Live Resend/WhatsApp provider proof remains environment dependent because no deployment credentials are stored in the repository.

## UI
Implemented:
- `/notifications`: self-scoped in-app inbox, unread count, per-item read and read-all.
- `/admin-dashboard/notifications`: templates, bounded audience campaign composer and delivery evidence log.
- authenticated site header links to the inbox.
- admin navigation links to the message center.

## Deliberate exclusions
Not invented in this slice:
- automatic parent weekly scheduling.
- parent WhatsApp/email opt-in preference semantics.
- marketing unsubscribe/consent policy.
- provider delivery/read webhooks.
- large 10,000-user campaign fan-out.
- notification retention/PII purge duration.
- Redis/SSE live fan-out.

Those require separate source-backed policy or deployment evidence. The durable inbox and worker do not depend on an unproven real-time transport.

## Verification checkpoint
- PR #64 merged from exact tested head `8f25fefd239f0a75d0ff93dad3d521cea565c848`.
- squash merge commit: `6c178b3c0106f8ed52c649b21865d289f9be6a92`.
- Database CI `36291528761`: PASS — migration apply, notification tables/indexes/constraints verification, complete rollback and re-apply.
- Backend CI `36291528793`: PASS — module lock, sqlc compile, gofmt, go vet and all Go tests including audience cap, actor scope, missing-variable rendering, retry accounting and provider fail-closed coverage.
- Frontend CI `36291528776`: PASS — typecheck + production build.
- Frontend E2E `36291528786`: PASS — complete browser suite including admin template/campaign creation and user inbox/read CSRF flows.
- browser evidence artifact `content-browser-evidence` id `10922073896`, digest `sha256:ce7ac43ab1be32ead19713d5259f2194f1a6b0576f1d7377e5f3cad54ef59b03`.
- the initial Backend run exposed gofmt-only deltas in the new notification files; they were corrected without changing behavior, then every required gate reran green on the exact final head.
