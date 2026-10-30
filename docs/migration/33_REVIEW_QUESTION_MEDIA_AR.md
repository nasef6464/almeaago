# REVIEW-MEDIA-01 — صور أسئلة المراجعة والتدريب من المرجع السلطوي

**التاريخ:** 2026-10-29. **الحالة:** PARTIAL / PR DRAFT؛ لا دمج أو نشر أو ترحيل.

## التتبع والمصدر

- Legacy READ-ONLY: `nasef6464/almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`، `pages/Favorites.tsx` يعرض `question.imageUrl` والاختيارات المصورة.
- Go base: `nasef6464/almeaago@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- PR مستقل: https://github.com/nasef6464/almeaago/pull/161 ، فرع `feat/review-question-media-20261029-run3`.
- فحص PRs المفتوحة قبل العمل: #159 للهيدر، #160 للمهارات والدروس، #158 للتنقل العام والاختبارات/النتائج؛ لا كتابة على فروعها أو الملفات التي يعدلها #158.

## الفجوة المؤكدة من الكود

`ReviewLibraryPage.tsx` و`ReviewPracticePage.tsx` يعرضان نص السؤال والاختيارات لكنهما لا يعرضان `imageAssetId` أو `option.assetId` الموجودين فعلًا في `learning-client.ts`. هذا يجعل سؤالًا بصريًا غير قابل للقراءة في المكتبة أو جلسة المراجعة، خصوصًا عند `optionsEmbeddedInImage=true`.

## شريحة التنفيذ

1. مكون مشترك `QuestionAssetImage` يقرأ فقط `GET /api/v1/media/assets/{id}` بجلسة الطالب، ثم يستعمل `publicUrl` للصورة النشطة فقط؛ لا نسخ للصور أو كشف أسرار R2 أو إضافة قاعدة بيانات موازية.
2. يظهر السؤال المصور والاختيارات ذات `assetId` في المكتبة والتدريب؛ إذا كانت الخيارات مدمجة في صورة السؤال تبقى أزرار الأحرف دون تكرار صورة الخيارات.
3. فشل metadata/CDN يبقي نص السؤال والأزرار دون ضياع، ويعرض خطأً واضحًا وزر إعادة المحاولة؛ لا تتغير الإجابات ولا درجات الإتقان.
4. `GET media/assets` الموجود أصلًا: `HTTP Handler.getAsset → media.Service.Get → postgres.Repository.Get → assets(id,status,public_url,mime_type)`. حالة `active` متاحة للطالب المصادق؛ الحالات غير النشطة لا تكشف للطالب غير المالك.
5. اختبارات Go إضافية تؤكد قراءة الطالب للصورة النشطة وحجب الصورة غير المكتملة؛ Playwright جديد يثبت صور السؤال/الخيار عند 390/820/1440، صورة الاختيارات المدمجة في جلسة المراجعة، وفشل GET ثم retry/reload.

## حالة الأدلة (تُحدّث بعد اكتمال CI على SHA النهائي)

| العقد | الحالة | الإثبات / الحد |
|---|---|---|
| الفجوة Legacy↔Go في صور المراجعة | VERIFIED (code) | Legacy `pages/Favorites.tsx` مقابل Go `ReviewLibraryPage.tsx`/`ReviewPracticePage.tsx` عند base |
| UI→HTTP→Go→PostgreSQL mapping | VERIFIED (code) | `learning-client.ts`, `media/transport/http/handler.go`, `media/application/service.go`, `media/repository/postgres/repository.go` |
| RED→GREEN للصور والمتصفح | PENDING CI | `apps/web/tests/e2e/learning-review-media.spec.ts`؛ first RED commit `b767a3a` |
| اختبار Go media authorization | PENDING CI | `internal/media/application/service_test.go` |
| PostgreSQL runtime/session E2E | UNKNOWN | لم تُنشأ بيانات PostgreSQL حية في هذا التشغيل؛ fixture browser لا تكفي |
| مطابقة صور Legacy↔Go لنفس الدور/البيانات | UNKNOWN | لقطات 390/820/1440 المتطابقة لم تُنتج؛ اختبارات عرض Go وحدها ليست Visual Parity |
| المحاولات والنتائج والاختبار المصور | PARTIAL | `AssessmentAttemptPage.tsx` و`AssessmentResultsPage.tsx` بهما placeholders للصور؛ #158 يعمل عليهما، لذا لم نكتب عليهما |

## قيود ومرحلة تالية

لا تغيير scoring أو RBAC أو الدفع أو schema أو Legacy أو production. يجب أولًا اعتماد بوابات Frontend/Backend/Database/E2E على SHA النهائي؛ ثم تنفيذ اختبار حقيقي بصلاحية طالب وبيانات assets في PostgreSQL وعرض R2 عند بيئة staging، ومقارنة صور Legacy↔Go. بعد مصالحة #158 تُنقل صور الاختبار والنتيجة في فرع مستقل دون تداخل. لا يُغلق نطاق الصور الشامل قبل ذلك.
