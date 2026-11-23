---
name: almeaa-api-contract-validator
description: >-
  Audits and verifies Go Chi HTTP API routes against Express endpoints in Legacy.
  Validates request/response JSON payloads, status codes (400, 401, 403, 404, 409),
  strict JSON decoding, localized Arabic error envelopes, and idempotency guarantees.
---

# ALMEAA API Contract Validator

## الغرض
التأكد من أن مسارات Go Chi الخلفية تطابق تماماً عقود الـ APIs القديمة وتدعم كافة متطلبات الواجهة دون أي كسر في الـ Payloads أو التوقعات.

## القواعد الصارمة
1. **Strict JSON Decoding:** التأكد من تطبيق فك ترميز JSON الصارم الذي يرفض أي حقول إضافية أو مستندات متتالية غير صالحة.
2. **صناديق الأخطاء (Error Envelopes):** الحفاظ على بنية رسائل الخطأ العربية الأصلية لمنع تسرب التفاصيل التقنية للواجهة.
3. **أكواد الحالة:**
   - `400 Bad Request`: للمدخلات غير الصالحة.
   - `401 Unauthorized`: للجلسات غير الموثقة أو المنتهية.
   - `403 Forbidden`: للوصول الممنوع بناءً على الدور أو المدرسة.
   - `404 Not Found`: للموارد غير الموجودة.
   - `409 Conflict`: للتنازع التزامني (Concurrency / Locking).
4. **التوافق العكسي:** التحقق من دعم مسارات التوافق القديمة مثل `/api/school-access/*` عبر `internal/organizations/transport/http/legacy_handler.go`.

## عقد المسار عند التعديل أو الاستعادة

- تتبّع إجراء React إلى عميل HTTP ثم `api/openapi/openapi.yaml` وتركيب المسار في Go والـDTO والخدمة والتخزين. طابق الطريقة والمسار والحماية والحمولة والرد، وافحص المستهلكين الآخرين قبل تغيير السلوك.
- في `PATCH` حدّد معنى الحقل الغائب و`null` والقيمة الفارغة، وأثبت بقاء الحقول التي لم تُعدّل. افحص رفض الحقل غير المعروف والحقل المملوك للخادم، وحالات غياب الصلاحية والعزل.
- أعد قراءة المورد من الخادم بعد إجراء الكتابة، وتحقق من أثره بعد تحديث الشاشة. سجّل أي اختلاف بين العميل، OpenAPI وGo كفجوة في العقد مع اختبار أو مرجع لكل طرف. إذا عرض الزر نجاحًا دون طلب، فابدأ بتوصيف العقد الأصلي وإثبات الفجوة الحالية.
