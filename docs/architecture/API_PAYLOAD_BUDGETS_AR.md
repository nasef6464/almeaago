# API Payload & Query Budgets

الأرقام هنا Baseline هندسي مبدئي وتُراجع بالقياس.

## Pagination defaults
- default page size: 20
- common max: 100
- endpoints الثقيلة قد يكون max أقل.
- أي استثناء يحتاج توثيق.

## Response design
### List endpoint
يرجع summary fields فقط.
مثال سؤال في القائمة:
- id/code
- short content preview
- type
- status
- difficulty
- skill summary/count
- thumbnail reference عند الحاجة

لا يرجع تلقائيًا:
- full explanation
- AI context
- voice metadata
- كل versions
- كل source payload
- binary media

### Detail endpoint
يرجع التفاصيل اللازمة للشاشة المحددة فقط.

## Hot endpoint budgets
الأهداف النهائية تُثبت باختبار staging/load، لكن كل endpoint يجب أن يسجل:
- DB query count.
- response bytes.
- p95 DB time.
- p95 total latency.
- cache hit/miss عند وجود cache.

## Dashboard rule
Dashboard لا يرسل raw attempts/answers فقط لحساب 4 counters في المتصفح.
إما query aggregate محسوبة بكفاءة أو read model مناسب.

## Smart Classroom
الـWebSocket لا يعيد broadcast للحالة الكاملة مع كل answer.
نرسل events/deltas صغيرة، مع snapshots دورية/عند reconnect فقط.

## Question media
الـAPI يرسل URL/metadata فقط.
المتصفح يحمّل الصورة من CDN/R2 مباشرة، مع cache headers.

## AI
لا ترسل تاريخ الطالب الكامل لكل prompt.
ابنِ context محدودًا ومقصودًا، واستعمل summaries/cache عندما يلزم.
