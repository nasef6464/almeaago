# PUB-RECOVERY-01 — استعادة رسالة استرداد كلمة المرور الأصلية

## مرجع ملزم

- Legacy READ ONLY: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go baseline: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- الأصل: `pages/ForgotPassword.tsx` يرسل `api.forgotPassword(email.trim())` ويعرض بعد أي استجابة ناجحة النص الثابت:
  **«إذا كان البريد مسجلًا، ستصلك تعليمات الاستعادة. تحقق من البريد الوارد والرسائل غير المرغوب فيها.»**
- Go baseline: `apps/web/src/features/auth/pages/ForgotPasswordPage.tsx` يعرض `response.message`، بينما `internal/identity/transport/http/handler.go` يرسل جملة إنجليزية. لذلك يرى الزائر نصًا مختلفًا في المسار الحقيقي.

## الشريحة المنفذة

- تغيير **نص الاستجابة العامة فقط** في `POST /api/v1/auth/forgot-password` إلى نص الأصل؛ الإبقاء على HTTP 200 لجميع حالات نجاح الطلب وعدم كشف وجود الحساب.
- لا تغيير في واجهة React أو عناصرها أو تنسيقها، ولا في محرك الجلسات/الصلاحيات/الإرسال/التخزين.
- إعادة استخدام `identity/application.Service.ForgotPassword` والـPostgreSQL repository القائم؛ لا جداول جديدة ولا تعديل للـschema.
- اختبارات Go على HTTP handler الحقيقي باستخدام repository معزول: عنوان غير صالح، فارغ، حساب غير موجود، فشل lookup، حساب موجود مع إصدار token واحد؛ يجب أن تعطي جميعها الرسالة العامة نفسها.
- تسعة اختبارات Playwright عند 390/820/1440 RTL: إرسال البريد المقصوص، خطأ 503 مع احتفاظ المدخلات وإعادة المحاولة، الرجوع والتقدم وإعادة التحميل. استجابات المتصفح mock؛ لا تُقدَّم على أنها اختبار PostgreSQL حي.
- مسار التتبع: الزائر ← `/forgot-password` ← `POST /api/v1/auth/forgot-password` ← `identityhttp.Handler` ← `identity/application.Service` ← `identity.Repository` (PostgreSQL في التشغيل الحقيقي) ← نص الرسالة في صفحة الزائر.

## حدود الاعتماد

| العنصر | الحالة |
|---|---|
| فرق النص بين المصدر والهدف | VERIFIED بالكود |
| إصلاح نص HTTP العام | IMPLEMENTED؛ اختبارات CI النهائية هي الحكم |
| عدم كشف وجود حساب | تغطية Go معزولة؛ PostgreSQL حقيقي NOT PROVEN |
| عرض الرسالة وفشل الحفظ وإعادة المحاولة والرجوع | اختبارات متصفح mocked؛ لا تُثبت مقارنة Legacy حيّة |
| صور Legacy↔Go بنفس الدور والبيانات عند 390/820/1440 | NOT PROVEN؛ الصور الحالية Go فقط |
| بقية الموقع العام والهيدر والدورات وإعدادات المدير | خارج هذه الشريحة؛ ما زالت PARTIAL |

## الملكية

هذه الشريحة لا تعدل `App.tsx` أو `LegacySiteHeader.tsx` أو `PublicLandingPage.tsx` أو `auth-parity.spec.ts` (فروع #158/#159/#166) ولا ملفات المدير/الطالب/المدارس. لا دمج ولا نشر ولا كتابة Legacy/إنتاج.
