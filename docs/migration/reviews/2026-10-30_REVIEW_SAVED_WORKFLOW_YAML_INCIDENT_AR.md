# حادثة CI: عدم صلاحية workflow حفظ مراجعة الطالب — 30 أكتوبر 2026

## نطاق الإثبات
- Legacy `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` للقراءة فقط.
- Go main قبل الإصلاح: `c1b5089c28d3ee9105734129d1dd60c732af1b17`.
- `Review Saved HTTP PostgreSQL` فشل عند دفع main، مثال تشغيل `41019896876` بنتيجة failure **وصفر jobs**. تكرر ذلك في دفعات push متتابعة؛ هذه ليست نتيجة فشل assertion في المنتج.
- الملف المتسبب: `.github/workflows/review-saved-http.yml` المدمج عبر #186 (`5302b62e3aada80119b552dff6c57c0f34ab9f31`).

## السبب والإصلاح المحدد
نهاية الملف كانت:
```yaml
        run: go test ./internal/learning/repository/postgres -run '^TestReviewSaved.*Postgres -count=1 -v
 -count=1 -v
```
السطر الأول لم يغلق الاقتباس الخاص بـ `-run`، والثاني أصبح scalar/سطرًا مشوهًا خارج بنية `jobs.steps`؛ لذلك رفض GitHub تشغيل workflow ولم يبدأ أي job.

الإصلاح الوحيد في workflow:
```yaml
        run: go test ./internal/learning/repository/postgres -run '^TestReviewSaved.*Postgres' -count=1 -v
```

## حدود الاعتماد
- هذا إصلاح CI مستقل عن الواجهة؛ لا تعديل في Go/React/API/schema أو scoring/payments/RBAC.
- لا يعتبر نجاح workflow شهادة تطابق Legacy أو إثبات browser→Go→PostgreSQL.
- قبول الدمج: نجاح `Review Saved HTTP PostgreSQL` وBackend CI وFrontend CI وDatabase CI وFrontend E2E على رأس PR النهائي؛ ثم فحص push main.
- المقارنة البصرية المقترنة 390/820/1440 وحالات الدور والبيانات تظل مسؤولية فرق الوظائف؛ ليست جزءًا من إصلاح workflow.
- لا نشر إنتاج ولا كتابة Legacy ولا cutover.
