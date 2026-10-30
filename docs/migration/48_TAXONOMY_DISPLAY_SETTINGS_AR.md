# إعدادات عرض المسار والمادة — تقرير إصلاح عقد التخزين

**التاريخ:** 2026-10-30  
**الحالة:** PARTIAL — إصلاحات أسباب فشل CI أُرسلت؛ الاعتماد ينتظر بوابات exact-head.

## النطاق ومعيار القبول

استعادة إعدادات العرض التي يحررها مدير المنصة للمسار والمادة عبر واجهة Taxonomy الحالية، ثم حفظها في PostgreSQL وإعادتها عبر public/admin bootstrap. تشمل قيم `false` و`stageLabel: ""` ودمج `settings` دون حذف مفاتيح غير معروفة، مع إبقاء عرض المسارات غير النشطة محصورًا في مدير المنصة. لا تغيير RBAC أو scoring أو commerce، ولا كتابة إلى المصدر القديم أو بيانات الإنتاج.

## نقاط الأساس

- Legacy read-only: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go main وقت فتح الدفعة: `a82145bbd840f8b743225bd33e4e293fdb176652`.
- PR: [#254](https://github.com/nasef6464/almeaago/pull/254).
- SHA قبل إصلاح CI: `eb0cbe3aad64676e21ef498eb103ff988077d126`.

## الفجوات المثبتة من الفشل الفعلي

1. **مخطط التخزين:** migration `000010_taxonomy_foundation` تنشئ `paths` و`subjects` دون عمود `presentation`. وجود العمود في `courses` لا يعني وجوده في جداول Taxonomy. لذلك فشل اختبار إتاحة المراحل وطلب تحديث المسار بخطأ PostgreSQL `column "presentation" does not exist`.
2. **fixture دورة الأب/الابن:** الاختبار المعزول ينشئ جدول `paths` يدويًا ولم يتضمن عمود العرض الذي يقرأه repository.
3. **اختبار Go:** `navigationRepoStub` يضمّن repository methods ذات pointer receivers، لكن الاختبار مرر قيمة بدل مؤشر؛ لذلك فشل `go vet` قبل `go test`.
4. **اختبار فصل المهارات:** محمّل parity لم يعرّف resolver للمكوّن الجديد `TaxonomyDisplayEditor`، ففشل الاختبار برسالة `Cannot find module './TaxonomyDisplayEditor'` رغم نجاح typecheck وbuild.

## الإصلاحات المرسلة

- أضيفت migration `000046_taxonomy_display_presentation` لإنشاء عمودي JSONB مستقلين في `paths` و`subjects` مع default كائن فارغ، وملف down مقابل. لا يتم تخزين بيانات العرض في Content أو HomepageSettings.
- حُدّث fixture اختبار دورة المسارات ليطابق عمود `presentation`.
- مرّر اختبار Navigation stub مؤشرًا، بما يطابق واجهة repository الفعلية.
- حمّل اختبار فصل المهارات `TaxonomyDisplayEditor` من مساره الصحيح بدل فشل resolver.
- صحّح `internal/taxonomy/README.md` ملكية التخزين ليذكر migration الجديدة.

## تتبع الرحلة

`مدير المنصة` → محرر عرض المسار/المادة في `TaxonomyAdminPage` → typed client → `PATCH /api/v1/taxonomy/admin/paths/{id}` أو `subjects/{id}` مع CSRF → `taxonomy/application.Service` (صلاحية مدير المنصة والتحقق من القيم) → `taxonomy/repository/postgres.Repository` (دمج JSONB وتدقيق ذري) → PostgreSQL → `GET /api/v1/taxonomy/bootstrap` → الهيدر/الرئيسية ومساحة المسار/المادة.

- حفظ المدير إلى PostgreSQL: **PENDING exact-head CI**.
- قراءة الزائر للقيم بعد إعادة التحميل: **PENDING exact-head CI**.
- رفض غير المدير وCSRF غير الصحيح: **PENDING exact-head CI**.
- عدم توسيع رؤية teacher/supervisor للمسارات غير النشطة: **PENDING exact-head CI**.
- الصور المقترنة Legacy/Go على 390/820/1440: **UNKNOWN / لم تُرفق لهذه الدفعة**.

## الاختبارات والبوابات

على SHA السابق `eb0cbe3`:
- Frontend typecheck/build: PASS.
- parity inventory: 10/11 PASS، وفشل resolver للمكوّن الجديد.
- Backend: فشل `go vet` بسبب pointer receiver في test stub.
- Database: فشل اختبار إتاحة المراحل قبل الوصول إلى اختبار العرض بسبب غياب عمود `presentation`.
- Taxonomy Path Cycle PostgreSQL: فشل fixture اليدوي بسبب العمود نفسه.

على SHA الإصلاح الحالي: لم تُستكمل نتائج CI بعد. لا تُنقل نتائج SHA السابق إلى الرأس الجديد، ولا يُعلن نجاح PostgreSQL قبل تشغيل الاختبارات على migrations الفعلية.

## الحدود والخطوة التالية

الهيدر الكامل وGate1 يظلان PARTIAL. هذه الدفعة لا تثبت تكافؤ الهيدر أو الصفحة الرئيسية ولا صلاحيات teacher/supervisor للمسارات غير النشطة. لا دمج ولا نشر ولا cutover. الخطوة التالية: فحص البوابات الأربع وworkflow PostgreSQL المخصص على SHA النهائي، إصلاح أي فشل متبقٍ دون تخفيف الاختبارات، ثم مراجعة مستقلة وإثبات رحلة المدير/الزائر بالصور المقترنة قبل اعتماد الدفعة.
