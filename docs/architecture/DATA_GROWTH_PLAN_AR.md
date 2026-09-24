# Data Growth Plan — ALMEAA V2

## الجداول المتوقع تضخمها بسرعة
1. assessment_attempts
2. assessment_answers
3. learning_events
4. mastery_evidence
5. classroom_events
6. notification_deliveries
7. audit_logs
8. ai_usage_events
9. payment_provider_events

## قواعد التصميم
- جداول التعريف الصغيرة لا تعامل مثل event tables.
- event/history tables لا تُحمّل كاملة داخل dashboard.
- كل جدول نمو سريع له created_at + stable id مناسب للـcursor.
- foreign keys الأساسية مفهرسة عندما تُستخدم في filtering/joining.
- لا نكرر نص السؤال/الصورة داخل answer/attempt event؛ نخزن identity/version المرجعية.
- التقارير السنوية/الشهرية تعتمد على aggregates/read models بدل scans متكررة على الأحداث الخام.

## مراحل النمو
### المرحلة A — التطوير
PostgreSQL واحدة، indexes الأساسية، synthetic load tests.

### المرحلة B — آلاف الطلاب
- query telemetry.
- slow-query review.
- Redis cache/read models للقراءات الساخنة.
- background aggregation.
- connection pool مضبوط بالقياس.

### المرحلة C — نمو أعلى
لا ننتقل تلقائيًا لتقنيات جديدة.
نقيم أولًا:
- partitioning للجداول الزمنية الكبيرة.
- read replicas للتقارير إن لزم.
- archival/retention.
- analytics store مستقل فقط عندما workload يثبت الحاجة.

## ممنوع
- Microservices/Kafka/ClickHouse لمجرد توقع نمو مستقبلي.
- denormalization عشوائي بدون قياس.
- حذف القيود relational لتسريع كتابة بسيطة.
- الاحتفاظ بأحداث لا قيمة لها إلى الأبد.
