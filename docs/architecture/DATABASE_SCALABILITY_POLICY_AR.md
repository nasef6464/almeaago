# Database Scalability & Bandwidth Policy

## الهدف
تصميم PostgreSQL من البداية لتخدم آلاف الطلاب والفصول والاختبارات بدون تضخم غير ضروري في CPU/RAM/Network أو تكرار بيانات.

## قواعد إلزامية

### 1. العلاقات
- العلاقات طويلة العمر تكون جداول Relational واضحة مع Foreign Keys.
- يمنع تخزين قوائم ضخمة من IDs داخل users أو JSON arrays عندما تكون علاقة حقيقية.
- Many-to-many تستخدم join tables بفهرسة الاتجاهين عند الحاجة.
- كل علاقة لها مالك Domain واضح.

### 2. الفهارس
كل Query متكررة أو حساسة يجب أن يكون لها Index Plan واضح.
أمثلة:
- user lookup by normalized email / national ID / phone.
- active session lookup by token hash.
- school membership by school + role + status.
- class membership by user/class.
- question lookup by code/status.
- question-skill lookup by skill/question.
- assessment attempts by student + assessment + status.
- progress/mastery by student + skill.

لا نضيف indexes عشوائية؛ كل Index له Query مستفيدة منه لأن زيادة الفهارس ترفع تكلفة الكتابة والتخزين.

### 3. Pagination
أي Collection قابلة للنمو يجب أن تكون paginated من أول endpoint.
- Cursor/keyset pagination للبيانات الكبيرة والمتغيرة.
- Offset pagination فقط للقوائم الصغيرة أو admin views التي لا تتطلب scale كبير.
- ممنوع endpoint يعيد آلاف الصفوف دفعة واحدة.

### 4. Projection
الـAPI يطلب فقط الأعمدة المطلوبة للشاشة.
- لا SELECT * في المسارات الساخنة.
- لا نرسل شرح السؤال، AI metadata، source metadata أو media details لو الشاشة تحتاج العنوان/العداد فقط.
- summary DTO منفصل عن detail DTO.

### 5. منع N+1
- لا Query لكل عنصر داخل loop.
- استخدم joins/batched queries/read models حسب الحالة.
- كل endpoint رئيسي له query-count budget.

### 6. العدادات والتقارير
العدادات الثقيلة لا يعاد حسابها من كامل الجداول مع كل page load.
- exact query مباشر عندما يكون رخيصًا.
- read model / rollup / materialized aggregate عندما يكبر الحجم.
- Redis cache للنتائج المتكررة التي تسمح بذلك.
- counters يجب أن يكون معناها موثقًا business-wise.

### 7. Media
PostgreSQL تخزن metadata/reference فقط.
الصور والصوت والفيديو والملفات الكبيرة في R2/CDN.
الـAPI لا يمرر ملفات كبيرة عبر السيرفر إلا لضرورة واضحة.
استخدم presigned direct upload/download حيث يلزم.

### 8. Bandwidth
- response payloads صغيرة ومحددة.
- gzip/brotli على الحواف أو reverse proxy عند النشر.
- cache headers للـstatic/media.
- conditional requests/ETag حيث تفيد.
- لا تكرر نفس metadata الكبيرة في كل response.
- frontend يستخدم lazy loading وrequest deduplication.

### 9. Connection Pool
- pool محدود وليس connection per request.
- قيم pool تضبط بالقياس حسب حجم instance وقاعدة البيانات.
- timeout لكل query/request.
- transactions قصيرة.
- لا external network call داخل DB transaction.

### 10. Query budgets
لكل endpoint حرج نسجل:
- p50 / p95 / p99.
- query count.
- rows scanned / returned.
- response bytes.
- DB time.
- cache hit ratio إن وجد.

أمثلة endpoints حرجة:
- login.
- student dashboard.
- question filters.
- assessment start/save/submit/result.
- skill progress.
- school dashboard.
- smart classroom state.

### 11. النمو
الجداول الأعلى نموًا متوقعة من البداية:
- assessment attempts.
- answers.
- learning events.
- skill evidence/mastery history.
- notification delivery.
- audit logs.
- AI usage.
- realtime classroom events.

لهذه الجداول:
- indexes محددة.
- retention policy عند الحاجة.
- archival/partitioning لا يطبق مبكرًا إلا بعد قياس، لكن التصميم لا يمنعه.
- لا تحفظ نفس الحقيقة في عدة جداول بدون سبب واضح.

### 12. Cache
Redis لتحسين الأداء فقط، وليس مصدر الحقيقة.
- cache keys versioned.
- TTL واضح.
- invalidation مرتبطة بأحداث domain عندما يلزم.
- cache miss يجب ألا يكسر correctness.

### 13. حماية قاعدة البيانات
- statement/query timeouts.
- bounded page sizes.
- rate limits للعمليات المكلفة.
- indexes وفحص EXPLAIN ANALYZE قبل إطلاق query ثقيلة.
- منع filters/sorts غير المفهرسة على مسارات جماهيرية بدون مراجعة.

## Acceptance
لا يعتبر endpoint قابلًا للتوسع لمجرد أنه يعمل على بيانات demo.
قبل إطلاق كل Domain نختبر ببيانات synthetic أكبر من الاستخدام المتوقع للمرحلة ونقيس:
- latency.
- query count.
- memory.
- CPU.
- response size.
- DB load.

الهدف: زيادة عدد الطلاب لا تؤدي إلى زيادة خطية غير ضرورية في البيانات المرسلة أو الاستعلامات لكل request.
