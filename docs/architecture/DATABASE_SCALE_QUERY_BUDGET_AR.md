# ALMEAA V2 — Database Scale & Query Budget Policy

## الهدف
تصميم PostgreSQL من البداية بحيث تخدم آلاف الطلاب والمدارس بدون تضخم في CPU/RAM/Network أو إعادة بناء مكلفة لاحقًا.

## القاعدة الأساسية
الأداء ليس مسؤولية السيرفر وحده. كل Endpoint له Query Budget وPayload Budget، وكل علاقة قابلة للنمو يجب أن تكون قابلة للفلترة والتقسيم والفهرسة من أول يوم.

## 1. العلاقات
- العلاقات طويلة العمر تحفظ في جداول Relational واضحة.
- ممنوع arrays غير محدودة داخل users/schools/assessments.
- Many-to-many تستخدم join tables مع unique constraints.
- الجداول التاريخية append-oriented ولا تمسح الحقيقة عند تغير الحالة الحالية.

## 2. Pagination
أي collection يمكن أن تكبر يجب أن تدعم pagination من أول endpoint:
- questions
- students
- attempts
- results
- notifications
- payments
- audit logs
- reports
- classroom events

الافتراضي 25-50 صفًا، والحد الأعلى يحدد لكل endpoint.
Cursor pagination تستخدم للجداول الكبيرة/المتحركة بدل OFFSET العميق.

## 3. Projection
- ممنوع SELECT * في hot paths.
- List endpoint يرجع summary fields فقط.
- Detail endpoint منفصل.
- لا نرسل explanation/AI context/media metadata/answer review إذا الشاشة لا تحتاجها.
- Student assessment payload لا يحتوي answer key/private explanation أثناء المحاولة.

## 4. Indexes
كل index يجب أن يخدم query مثبتة.
أولوية composite indexes:
- tenant/school + state + time/id.
- user + status + time/id.
- assessment + user/attempt state.
- skill + approved question.
- session token hash + expiry/revoked state.
- entitlement user + scope + state + expiry.

يمنع الإفراط في indexes لأن كل index يزيد write cost/storage.

## 5. Multi-tenant query shape
أي جدول school-scoped يجب أن يجعل school/tenant scope جزءًا مبكرًا من query/index عند الاستعلامات المتكررة.
لا نقرأ كل المنصة ثم نفلتر في التطبيق.

## 6. N+1 ممنوع
أي endpoint يعرض قائمة يجب ألا ينفذ query إضافية لكل صف.
الحلول:
- joins المحدودة.
- batch queries.
- precomputed read models.
- application-level batching.

## 7. Query budget
لـ hot student/admin endpoints:
- target: 1-5 SQL statements عادة.
- أي endpoint يتجاوز 10 SQL statements يحتاج مراجعة معمارية.
- query latency وrow count وbytes ترصد في staging.
- أي query ثقيلة تحفظ لها EXPLAIN (ANALYZE, BUFFERS) أثناء التحقق.

الأرقام Targets وليست SLA نهائية؛ نثبتها بالقياس تحت load.

## 8. Connection pool
- pool محدود؛ لا connection لكل request.
- البداية الحالية API: MaxConns=20 / MinConns=2 لكل instance.
- لا نرفع pool لمجرد بطء query.
- نراقب DB max connections وqueue/wait time قبل تغيير القيم.
- worker pool مستقل عند تشغيل jobs فعليًا.

## 9. Counters & analytics
لا نحسب إحصاءات كبيرة من raw history في كل page load.
نستخدم حسب الحالة:
- indexed COUNT DISTINCT للـscope الصغير.
- cached counters.
- rollup tables.
- materialized/read models.
- background recomputation.

مثال question-skill:
COUNT(DISTINCT question_id)، وليس عدد روابط question_skill.

## 10. Historical/event growth
attempt answers, mastery evidence, audit, notification deliveries, classroom events وAI usage جداول نموها سريع.

من البداية:
- created_at/id indexes.
- retention policy حسب النوع.
- archive/partition only when measured size justifies it.
- PostgreSQL time partitioning لا يضاف مبكرًا بلا دليل.

## 11. Reports/Exports
- التقرير الخفيف endpoint مباشر.
- التقرير الكبير job في background.
- export لا يبقى request HTTP مفتوحًا دقائق.
- النتيجة تحفظ مؤقتًا في object storage عند الحاجة.

## 12. Redis
Redis يستخدم لـ:
- cache bounded summaries.
- rate limits.
- ephemeral realtime state.
- jobs/coordination.

Redis ليس System of Record، وفقدانه لا يجب أن يفسد صحة البيانات.

## 13. Bandwidth
تقليل DB/API/network bytes:
- page-scoped APIs.
- compact response DTOs.
- gzip/brotli at edge/server where appropriate.
- ETag/cache headers للبيانات شبه الثابتة.
- R2/CDN للصور والصوت والملفات.
- لا Base64 media في JSON.
- لا duplicate media payloads.
- WebSocket events صغيرة ودلالية، لا snapshots ضخمة كل tick.

## 14. Question Bank
- السؤال له stable identity.
- الاختبارات والمراجعة تشير إلى ID/version.
- السؤال لا ينسخ داخل كل assessment.
- الصور خارج DB.
- filters لها indexes واقعية.
- counts منفصلة عن rows عند الحاجة، ولا exact count مكلف لكل scroll.

## 15. Assessments
- autosave يكتب answer delta، لا snapshot كامل للمحاولة.
- submit idempotent.
- result summary منفصل عن review detail.
- historical assessment version ثابت.

## 16. Student dashboard
Dashboard لا يقرأ كل progress/results/questions.
يستخدم summary queries/read models:
- current enrollments.
- current goals.
- recent activity.
- weak skills summary.
- next best action.

التفاصيل lazy-loaded عند فتح القسم.

## 17. School dashboards
School dashboards تستخدم scoped aggregates.
ممنوع تحميل آلاف الطلاب + كل محاولاتهم ثم حساب المؤشرات في React.

## 18. Load gates
قبل staging release لكل domain حرج نقيس:
- p50/p95/p99.
- SQL count/request.
- slowest queries.
- rows scanned vs returned.
- response bytes.
- DB CPU/memory.
- connection wait.
- cache hit ratio.
- request throughput.

## 19. Growth checkpoints
نراجع خطة البيانات عند أحجام تقريبية:
- 10k users.
- 100k questions.
- 1m attempts/evidence rows.
- 10m event/delivery/audit rows.

لا نضيف sharding أو ClickHouse أو Kafka قبل وجود قياس يبررها.

## 20. قاعدة الرفض
أي Feature جديدة تعرض query غير bounded، أو تحمل dataset كامل للمتصفح، أو تحتاج scan واسع لكل request، تعتبر غير جاهزة حتى يعاد تصميم access pattern.

## النتيجة
ALMEAA V2 تبدأ بقاعدة PostgreSQL بسيطة وقوية، لكن كل جدول وendpoint مصمم من أول يوم ليتوسع بدون أن تتحول السرعة أو الباندويث إلى مشكلة مفاجئة.
