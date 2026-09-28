# Communication / Notifications Integrated Parity Certification

Status: **FINAL DOCUMENTATION GATE CANDIDATE**

## Source basis
Audited against legacy checkpoint `a5bcd4a1b43316d6dfc0c75e7f2d91a2e8d294e9` and the merged V2 Notifications foundation.

Source-backed legacy behaviors selected for this certification:
- authenticated Redis-backed SSE inbox refresh with unread-count updates;
- large campaign audiences capped at 10,000, pre-counted before contact resolution and processed in keyset pages;
- weekly parent report scheduling at Sunday 08:00 Asia/Riyadh with a deterministic execution identity;
- parent WhatsApp weekly digest only after explicit `whatsappDigestEnabled` opt-in.

## Existing trusted V2 foundation
Already merged:
- normalized templates, campaigns and per-channel delivery rows;
- platform-admin template/campaign writes with CSRF and optimistic template revision;
- self-scoped in-app inbox/read state;
- email/WhatsApp worker with PostgreSQL `SKIP LOCKED`, finite retry/backoff and provider evidence fields;
- server-resolved active Identity audience; the browser never supplies recipient email/phone;
- provider configuration stays server-side and live provider success remains external evidence.

## Certification additions

### 1. Durable inbox truth + Redis refresh-only realtime
PostgreSQL remains the notification truth. The communication Redis channel publishes only a self-scoped refresh event containing user ID, campaign ID, event type and timestamp. It never carries notification title/body, email, phone or answer/result payloads.

`GET /api/v1/notifications/stream`:
- authenticates the current session;
- subscribes only to that user's Redis channel;
- emits initial unread count, refresh events and bounded keepalives;
- re-reads unread truth from PostgreSQL after an event.

The browser responds to the SSE refresh by reloading the normal authenticated inbox API. Redis loss therefore degrades immediacy, not durable inbox truth.

### 2. Bounded 10k campaign fan-out
Campaign creation:
- counts the complete server-authorized audience before contact projection;
- fails closed above 10,000 rather than silently truncating;
- resolves active Identity recipients by UUID keyset pages of 500;
- inserts delivery rows in PostgreSQL batches of 500;
- pipelines Redis refresh signals where supported.

This preserves the legacy 10k contract while avoiding a browser inventory or offset-based fan-out loop.

### 3. Narrow parent WhatsApp preference
V2 adds `notification_preferences.parent_whatsapp_digest_enabled` only. It is deliberately narrow:
- parent-only self-service update;
- optimistic revision;
- default false;
- it does not imply marketing consent, generic WhatsApp consent or provider delivery success.

No broader consent center is invented because the source does not define its policy.

### 4. Weekly parent report automation
The worker evaluates the schedule in Asia/Riyadh and runs during Sunday 08:00 local hour. Each parent report:
- uses the Parents owner-domain weekly composition;
- Parents bulk-composes canonical Organizations authority + Identity profiles + Assessment aggregates + Learning weak-skill/next-action projections;
- skips parents with no linked children or no weekly Assessment activity;
- always creates an in-app report;
- adds WhatsApp only for an explicitly opted-in parent with a phone number;
- uses `weekly-parent-report:<Sunday>:<parentId>` campaign idempotency, so multi-worker/retry execution cannot duplicate the persisted campaign;
- leaves external provider delivery to the existing retrying worker.

## Ownership and privacy
- Identity owns user contact/role projection.
- Organizations owns canonical parent-child authority.
- Parents owns weekly parent-facing composition.
- Assessment owns result truth.
- Learning owns weak-skill/recommended-action truth.
- Communication owns templates, preference, delivery orchestration, retry state and ephemeral inbox refresh signals.
- Redis never becomes a second notification store.
- the browser never chooses recipient contact data.

## Explicit external / UNKNOWN boundaries
This certification does not fabricate:
- live Resend/WhatsApp provider delivery proof;
- provider delivery/read callback contracts;
- generic marketing unsubscribe/consent policy;
- physical retention/purge policy for delivery history.

Those remain external or product-policy evidence until explicitly sourced.

## Closure gate
The final documentation-inclusive head must pass Database CI, Backend CI, Frontend CI and Frontend E2E on the same SHA. Browser evidence must include:
- admin bounded-campaign messaging;
- self-scoped realtime inbox refresh;
- read/read-all CSRF;
- parent mobile explicit weekly WhatsApp opt-in.

Status remains TESTED rather than PARITY_PROVEN without live provider/runtime visual evidence.

## Green implementation checkpoint
Implementation head `953eddda6ea6d8453c9c8f2312122fc1c91f5518` passed all four required gates on the same SHA:
- Database CI `36387308155`.
- Backend CI `36387308196`.
- Frontend CI `36387308152`.
- Frontend E2E `36387308249` — 67/67.
- browser evidence artifact `10954488147`, digest `sha256:bfdb5a0ef335a7a0e26ae706854aa390ee00ac960c93b9c4c871ffd49abc9cde`.

The implementation gate also proves the notification parity migration applies, rolls back and reapplies; Go module/vet/tests pass; production frontend builds; and browser coverage exercises bounded admin campaigns, self-scoped realtime inbox refresh, read/read-all safety and parent weekly WhatsApp opt-in.

## Final same-domain legacy delta re-check
The latest legacy commit remains `a5bcd4a1b43316d6dfc0c75e7f2d91a2e8d294e9`. Its changed runtime paths are LessonProgress/QuestionRevision storage hardening plus auth/quiz storage integration and related scripts. It does not modify notification campaigns, inbox/SSE, weekly parent-report scheduling, notification audience authority or WhatsApp digest preference behavior. No additional Communication behavior is copied from that delta.
