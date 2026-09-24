# 09 — Data Growth, Bandwidth, Caching & Performance Rules

## 1. الهدف

النسخة الجديدة يجب أن تتحمل نمو:
- users/schools/classes.
- questions/skills.
- attempts/answers/results.
- AI interactions.
- notifications.
- classroom events.
- images/audio/files.
دون أن يتحول كل request إلى تحميل شامل أو نسخ بيانات.

## 2. قاعدة عدم التضخم

قبل إضافة أي field/array/snapshot:

> هل هذه نسخة من كيان موجود ويمكن استبدالها بـID أو version reference؟

إذا نعم، لا تنسخ إلا إذا توجد ضرورة تاريخية/قانونية موثقة.

## 3. لا Arrays غير محدودة على User

Current legacy has arrays مثل:
- enrolledCourses
- completedLessons
- favorites/reviewLater
- groupIds
- linkedStudentIds

Target:
- join/progress tables.
- user row يبقى bounded.
- counters derived/materialized separately.

## 4. Question/Media

- one question identity.
- one asset per unique hash/version.
- quizzes/reviews use IDs.
- CDN/R2 serve bytes directly.
- WebP/optimized images.
- thumbnails فقط عند حاجة UI.
- lazy loading.
- hashed keys => long cache TTL.

## 5. API Payload Strategy

Split:
- summary endpoint.
- detail endpoint.
- analytics endpoint.
- export job.

Never return full:
- question bank.
- all attempts.
- all results.
- all school students.
- all AI logs
inside dashboard bootstrap.

## 6. Pagination

Default لكل growing collection:
- page/cursor.
- hard max limit.
- sort stable.
- filter indexes.

Prefer cursor pagination for event/history streams at very large volume.

## 7. Counts

Exact COUNT can become expensive.

Rules:
- UI list may use `hasMore` without total.
- exact total only where business requires.
- coverage counters cached/materialized.
- counts always scoped.
- refresh async after writes if exact realtime not needed.

## 8. Caching

### Browser/CDN
- immutable hashed media.
- static bundles.
- public presentation data where safe.

### Redis
- taxonomy.
- public content summaries.
- entitlement resolution short TTL if invalidation reliable.
- rate-limit counters.
- distributed locks.
- AI cache.
- realtime pub/sub.
- report status.

Do not cache:
- answer keys in client/public caches.
- security decisions for long TTL.
- secrets.

## 9. Current cache migration note

Current Question summary uses short in-process Map cache.
Target multi-instance must use shared cache or accept no cache; never rely on per-process correctness.

## 10. Background Jobs

Queue:
- notifications.
- emails/WhatsApp.
- report/PDF exports.
- large imports.
- image processing.
- cleanup.
- AI batch preprocessing.
- analytics rollups.

HTTP request creates job and returns job ID where operation is heavy.

## 11. Realtime

- WebSocket instances stateless قدر الإمكان.
- Redis pub/sub/streams for fanout.
- durable final state in PostgreSQL.
- do not persist every transient UI tick if no analytical value.
- throttle teacher/projector aggregates.

## 12. Attempts/Events Growth

QuestionAttempt volume may become الأكبر.

Target strategies:
- indexed append writes.
- partitioning later only after measurement.
- rollups for reports.
- retention rules for low-value telemetry.
- academic evidence retention separate from debug events.

## 13. Analytics

Keep:
- source events needed for audit.
- materialized learner skill state.
- class/school rollups.
- recompute ability where practical.

Avoid computing school-wide reports by scanning all raw answers on every page load.

## 14. Retention Matrix — PROPOSED, owner/legal decision required

Classes:
- authentication/security events.
- audit logs.
- payment events.
- academic attempts/results.
- AI interaction payloads.
- token/cost metrics.
- notification deliveries.
- client telemetry.
- classroom realtime transient events.

Each needs:
- purpose.
- retention period.
- PII classification.
- archive/delete rule.
- legal/business owner.

No arbitrary TTL until policy approved.

## 15. Database indexes

For every endpoint:
- inspect filter + sort.
- create composite index for real query.
- avoid speculative excessive indexes.
- monitor slow queries.
- EXPLAIN on PostgreSQL before declaring performance.

## 16. PostgreSQL write rules

- transactions only around business invariants.
- idempotency for payment/import/submit.
- foreign keys.
- unique keys.
- check constraints.
- bulk COPY/import for large safe batches.
- connection pool bounded.

## 17. Bandwidth Budget

Track per workflow:
- API response bytes.
- R2/CDN bytes.
- websocket event bytes.
- AI request/response tokens.
- export bytes.

Student dashboard should use KB-scale summaries, not MB-scale catalogs.

## 18. Media Delivery

Production R2 should use custom domain/CDN cache.
r2.dev testing endpoint is not production delivery policy.
Cache mutable aliases cautiously; hashed assets can be immutable.

## 19. Client performance

- route lazy loading.
- feature code splitting.
- no giant admin bundle.
- virtualized/paginated large tables if needed.
- image dimensions/responsive loading.
- defer noncritical hydration.

## 20. Performance acceptance

Measure:
- p50/p95/p99.
- error rate.
- DB query count/time.
- cache hit.
- memory/CPU.
- response bytes.
- active sockets.
- AI token/cost.

Test workflows:
login, dashboard, question bank, assessment start/save/submit, results, reports, school roster, classroom, AI.
