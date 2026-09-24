# ALMEAA V2 — Engineering Completeness Checklist

هذا الملف يغطي الأشياء التي يجب أن يقوم بها الفريق حتى لو لم يطلبها مالك المشروع بالاسم.

الحالة لكل بند:
NOT_STARTED · IN_PROGRESS · VERIFIED · NOT_APPLICABLE.

## 1. Architecture
- [ ] كل Feature لها Domain owner واضح.
- [ ] لا Business Logic داخل HTTP handlers.
- [ ] Cross-domain dependencies بعقود صريحة.
- [ ] ADR لأي قرار معماري مؤثر.
- [ ] لا Microservices قبل وجود سبب مقاس.

## 2. Database
- [ ] PK/FK/Unique/Check constraints صحيحة.
- [ ] Index plan لكل hot query.
- [ ] Pagination لكل collection قابلة للنمو.
- [ ] لا unbounded arrays للعلاقات.
- [ ] لا SELECT * في hot paths.
- [ ] N+1 checks.
- [ ] migration up/down/reapply في CI.
- [ ] synthetic scale dataset.
- [ ] EXPLAIN ANALYZE للـhot queries قبل staging release.
- [ ] retention/archive plan للجداول الأسرع نموًا.

## 3. Performance & Bandwidth
- [ ] p50/p95/p99 للـcritical endpoints.
- [ ] query count budget.
- [ ] response byte budget.
- [ ] DB connection-pool budget.
- [ ] cache hit ratio حيث يوجد cache.
- [ ] R2/CDN للـmedia.
- [ ] direct uploads بدل proxy للملفات الكبيرة.
- [ ] websocket deltas بدل full-state broadcast.
- [ ] no unnecessary dashboard bootstrap.

## 4. Security
- [ ] Argon2id password storage.
- [ ] opaque revocable sessions.
- [ ] HttpOnly/Secure cookie policy.
- [ ] CSRF protection.
- [ ] strict CORS allow-list.
- [ ] rate limits حسب endpoint.
- [ ] account lock/throttling.
- [ ] hashed OTP/reset/verification tokens.
- [ ] no secrets in Git/logs/frontend.
- [ ] role + scope + assignment + entitlement server-side authorization.
- [ ] cross-school/cross-student negative tests.
- [ ] security headers.
- [ ] upload MIME/size/content controls.
- [ ] audit trail للعمليات الحساسة.
- [ ] dependency/security scanning قبل production.

## 5. Privacy & Data Lifecycle
- [ ] تحديد PII لكل Domain.
- [ ] minimum-data responses.
- [ ] delete/deactivate policy.
- [ ] retention policy.
- [ ] backup data handling.
- [ ] logs لا تحتوي secrets/OTP/passwords.
- [ ] export/delete account workflow قبل production.

## 6. Reliability
- [ ] timeouts لكل external dependency.
- [ ] bounded retries + backoff.
- [ ] idempotency للـpayment/submit/import/grants.
- [ ] transactions للعمليات متعددة الخطوات.
- [ ] outbox حيث side effects تحتاج ضمان.
- [ ] queue poison/dead-letter policy.
- [ ] graceful shutdown.
- [ ] readiness/liveness.
- [ ] degraded behavior عند سقوط Redis/AI/provider حيث يمكن.

## 7. Backup & Disaster Recovery
- [ ] automated PostgreSQL backups قبل production.
- [ ] restore drill وليس backup فقط.
- [ ] RPO/RTO موثق.
- [ ] R2 recovery/versioning policy.
- [ ] runbook لحوادث database/deployment/provider.

## 8. Observability
- [ ] structured logs + request ID.
- [ ] traces للـcritical journeys.
- [ ] metrics لـlatency/errors/DB/cache/queue/websocket.
- [ ] Sentry قبل staging العام.
- [ ] alert thresholds.
- [ ] no high-cardinality metric labels بلا داعٍ.
- [ ] dashboards تشغيلية محددة.

## 9. Frontend Quality
- [ ] Visual parity desktop/mobile.
- [ ] RTL كامل.
- [ ] loading/empty/error/offline states.
- [ ] keyboard navigation.
- [ ] accessible labels/focus/contrast.
- [ ] no giant feature components.
- [ ] API types/contracts generated أو validated.
- [ ] lazy loading/code splitting عند القياس.
- [ ] image sizing/lazy loading.
- [ ] no duplicate requests.

## 10. Tests
- [ ] unit tests للمنطق.
- [ ] integration tests للـDB.
- [ ] API contract tests.
- [ ] E2E للـGolden Journeys.
- [ ] authorization negative tests.
- [ ] visual regression للواجهات الحرجة.
- [ ] load tests قبل scale claims.
- [ ] failure/retry/idempotency tests.
- [ ] restore test للbackup.

## 11. Realtime / Smart Classroom
- [ ] reconnect/resume.
- [ ] presence expiry.
- [ ] authorization لكل socket/session.
- [ ] no answer-key leakage.
- [ ] bounded event size/rate.
- [ ] durable final state في PostgreSQL.
- [ ] transient state في Redis فقط عند الحاجة.
- [ ] immutable end-of-session report snapshot.

## 12. AI
- [ ] provider abstraction.
- [ ] prompt versioning.
- [ ] bounded trusted context.
- [ ] token/cost/latency ledger.
- [ ] cache للشرح المتكرر.
- [ ] fallback/circuit breaker.
- [ ] permissions على student targets.
- [ ] AI لا يملك score/mastery truth.
- [ ] no sensitive data leakage to providers beyond required context.

## 13. Commerce
- [ ] server-resolved prices.
- [ ] signed/verified provider webhook.
- [ ] provider event uniqueness.
- [ ] idempotent entitlement grant.
- [ ] audit ledger.
- [ ] refund/revoke policy.
- [ ] payment and entitlement transaction boundary.

## 14. Delivery / Cost Control
- [ ] GitHub Actions path-filtered.
- [ ] cancel obsolete CI runs.
- [ ] heavy E2E/load manual/release gate.
- [ ] no Vercel preview on every commit.
- [ ] no docs-only deployment.
- [ ] Render deploy only for approved staging/release.
- [ ] monthly resource review before scaling services.

## 15. Developer Experience
- [ ] README start path.
- [ ] CURRENT_STATE updated.
- [ ] WORKING_SET updated.
- [ ] Error Ownership Map updated.
- [ ] one-command local infra.
- [ ] migrations documented.
- [ ] seed/test accounts documented without secrets.
- [ ] naming conventions.
- [ ] no hidden manual step for normal development.

## 16. Production Gate
لا يسمى المشروع Production Ready حتى:
- كل Critical capability تصل PARITY_PROVEN أو INTENTIONALLY_CHANGED.
- security gate verified.
- load/performance baseline verified.
- backup/restore verified.
- observability verified.
- staging soak verified.
- rollback/runbook verified.
