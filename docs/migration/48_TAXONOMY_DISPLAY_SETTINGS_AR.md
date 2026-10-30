# إعدادات عرض المسار والمادة — تقرير إصلاح عقد التخزين والنطاق

**التاريخ:** 2026-10-30  
**الحالة:** PARTIAL — إصلاحات Go والاختبارات أُرسلت؛ بوابات exact-head الجديدة ما زالت مطلوبة، وأثر الإعدادات على المستهلك المرئي غير مثبت.

## النطاق ومعيار القبول

استعادة إعدادات العرض التي يحررها مدير المنصة للمسار والمادة عبر واجهة Taxonomy الحالية، ثم حفظها في PostgreSQL وإعادتها عبر public/admin bootstrap. تشمل حفظ `false` ودمج `settings` دون حذف مفاتيح غير معروفة؛ وتُحافظ واجهة المصدر على تسمية المرحلة الافتراضية عند ترك الحقل فارغًا، مع إبقاء عرض المسارات غير النشطة محصورًا في مدير المنصة. لا تغيير RBAC أو scoring أو commerce، ولا كتابة إلى المصدر القديم أو بيانات الإنتاج.

## نقاط الأساس

- Legacy read-only: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go main وقت فتح الدفعة: `a82145bbd840f8b743225bd33e4e293fdb176652`.
- PR: [#254](https://github.com/nasef6464/almeaago/pull/254).
- SHA قبل إصلاح CI: `eb0cbe3aad64676e21ef498eb103ff988077d126`.

## الفجوات المثبتة من الفشل الفعلي

1. **إتاحة المراحل للمتعلم:** PostgreSQL أثبت أن `ValidateMasteryGoalScope` و`ValidateStudyPlanScope` كانا يقبلان مادة مرتبطة بمرحلة غير نشطة/مؤرشفة، بينما public bootstrap يخفيها. أضيف تحقق المستوى النشط عند اختيار مادة صريحة، مع إبقاء المواد بلا مرحلة، وخطة كل المواد، ونطاق المسار وحده على دلالاتها الحالية.
2. **fixture دورة الأب/الابن:** الاختبار المعزول ينشئ جدول `paths` يدويًا ولم يتضمن عمود `presentation` الذي يقرأه repository؛ أضيف العمود إلى fixture.
3. **اختبار Go:** `navigationRepoStub` يضمّن repository methods ذات pointer receivers، لكن الاختبار مرر قيمة بدل مؤشر؛ أصبح يمرر مؤشرًا.
4. **اختبار فصل المهارات:** محمّل parity لم يعرّف resolver للمكوّن الجديد `TaxonomyDisplayEditor`، فأخفق برسالة `Cannot find module './TaxonomyDisplayEditor'` رغم نجاح typecheck وbuild.

## تصحيح مهم لمخطط التخزين

كان استنتاج أن أعمدة `presentation` غير موجودة في `paths` و`subjects` خاطئًا. فحص `migrations/000001_platform_foundation.up.sql` أثبت أن العمودين موجودان منذ تأسيس المنصة. أول تشغيل PostgreSQL على الرأس الذي أضفنا فيه migration جديدة كشف التكرار صراحةً: `column "presentation" of relation "paths" already exists`. أزيلت migration الزائدة وملف rollback؛ لا يلزم تغيير مخطط أو إضافة migration لهذه الإعدادات.

## الإصلاحات المرسلة

- `ValidateMasteryGoalScope`: يشترط أن تكون المرحلة المرتبطة بالمادة نشطة؛ تبقى المادة غير المرتبطة بمرحلة صالحة.
- `ValidateStudyPlanScope`: يرفض اختيار مادة صريحة ذات مرحلة غير نشطة/مؤرشفة؛ يحافظ على معنى القائمة الفارغة «كل المواد النشطة» وعلى خطة المسار وحده.
- fixture اختبار دورة المسارات صار يعكس عمود `presentation` الموجود في المخطط الحقيقي.
- اختبار Navigation stub يمرر مؤشرًا مطابقًا لواجهة repository.
- محمّل اختبار فصل المهارات يحمل `TaxonomyDisplayEditor` الفعلي.
- `internal/taxonomy/README.md` يوثق المصدر الصحيح للأعمدة: migration `000001_platform_foundation`.
- سُجل فشل migration المكررة ولم يُخفَ؛ أزيلت بدل استخدام `IF NOT EXISTS` لإسكات الخطأ.

## تتبع الرحلة

`مدير المنصة` → محرر عرض المسار/المادة في `TaxonomyAdminPage` → typed client → `PATCH /api/v1/taxonomy/admin/paths/{id}` أو `subjects/{id}` مع CSRF → `taxonomy/application.Service` (صلاحية مدير المنصة والتحقق من القيم) → `taxonomy/repository/postgres.Repository` (دمج JSONB وتدقيق ذري) → أعمدة `presentation` القائمة في PostgreSQL → `GET /api/v1/taxonomy/bootstrap`.

- حفظ المدير/الدمج/التدقيق: **يتطلب إعادة إثبات على exact head**.
- public/admin bootstrap: **كود الإسقاط موجود؛ يتطلب اختبار exact head**.
- أثر `showInHome` في الصفحة الرئيسية: **NOT WIRED في main المفحوص**.
- أثر `showInNavbar` في الهيدر: **NOT WIRED في main المفحوص**؛ ملكية الهيدر في شريحة التنقل، ولا يُعدل ملف الهيدر المتداخل هنا.
- صور Legacy/Go على 390/820/1440: **UNKNOWN / لم تُرفق لهذه الدفعة**.

## الاختبارات والبوابات

على SHA السابق `eb0cbe3`:
- Frontend typecheck/build: PASS؛ parity inventory: 10/11 PASS وفشل resolver.
- Backend: فشل `go vet` بسبب pointer receiver في test stub.
- Database: فشل اختبار learner scope لأن الهدف/الخطة قبلا مادة مرحلة غير نشطة.
- Taxonomy Path Cycle PostgreSQL: فشل fixture اليدوي بسبب عدم تضمين `presentation`.

على SHA `a3aaaa9` بعد إصلاحات الاختبارات الأولى:
- Frontend CI: PASS.
- Backend CI: PASS.
- Taxonomy Path Cycle PostgreSQL: PASS.
- Frontend E2E: كان قيد التنفيذ وقت التسجيل.
- Database CI: FAIL عند تطبيق migration مكررة أُضيفت بالخطأ؛ كشف ذلك أن الأعمدة موجودة أصلًا. لا تُنقل نتائج هذا الرأس إلى الرأس التالي.

على الرأس بعد إزالة migration الزائدة وإصلاح تحقق المرحلة: **CI exact-head لم يكتمل بعد**.

## الحدود والتعارضات والخطوة التالية

- الهيدر الكامل وGate1 يظلان PARTIAL. هذا PR يثبت عقد إعدادات Taxonomy وحفظها وإسقاطها، لكنه لا يثبت بعد أن الهيدر والرئيسية يستهلكان `showInNavbar/showInHome`.
- PR #158 قديم ومبني على main أقدم، ويتداخل في ملفات الهيدر والتصنيف؛ لا يدمج wholesale. migration `000046_learning_navigation_preferences` في ذلك الفرع ليست جزءًا من هذه الدفعة، ويجب مصالحة ترتيبها عند إعادة تطبيق أي delta منه.
- لا دمج ولا نشر ولا cutover. الخطوة التالية: اجتياز Backend/Frontend/Database/E2E وTaxonomy Path Cycle على الرأس النهائي، ثم مراجعة مستقلة؛ بعدها تُسلّم حقول العرض إلى مالك مستهلك الهيدر/الرئيسية لاختبار الأثر المرئي والصور المقترنة.


## تحديث 30 أكتوبر — مطابقة سلوك تسمية المرحلة ونتيجة E2E

- **مصدر السلوك:** Legacy `dashboards/admin/components/StudentExperienceSettings.tsx` عند `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` (blob `4c10caab4152514da2d94de16cd3e5f3fa0390ce`). القيمة الافتراضية هي `اختر مرحلتك`، وكل من `PathStudentExperiencePanel.save` و`PathsManager` يحوّل النص الفارغ بعد trim إلى هذه القيمة قبل الإرسال.
- **الفجوة:** محرر Go كان يرسل `stageLabel: ""` مباشرةً عند مسح الحقل؛ وهذا يختلف عن سلوك المصدر حتى لو كان تخزين JSONB قادرًا على حفظ النص الفارغ.
- **الإصلاح:** محرر Go يحتفظ بالمسودة الفارغة أثناء التحرير، لكنه يرسل `اختر مرحلتك` عند الحفظ. اختبار Playwright يثبت المسودة الفارغة قبل الحفظ، والقيمة الافتراضية في الطلب وبعد إعادة التحميل. اختبار HTTP/PostgreSQL المنخفض المستوى ما زال يثبت أن API يحفظ `""` صراحةً إذا أرسله عميل مباشر، مع الحفاظ على مفاتيح JSONB الأخرى؛ فصلنا تطبيع واجهة المصدر عن دلالة PATCH التخزينية.
- **Exact head الحالي:** `453061f5b368ea9a4c01bf7d2171bd4496485988`. نتائج CI السابقة على `60e51c5` لا تُنقل إلى هذا الرأس؛ بوابات الرأس الجديد ما زالت تنتظر التشغيل/النتيجة.
- **E2E السابق على `60e51c5`:** 347 PASS / 1 FAIL / 3 SKIPPED. الفشل الوحيد في `admin-content-skill-hydration.spec.ts` عند 390px بعد reload، وليس في ملف من ملفات PR #254: checkbox المهارة `الأعداد` عاد unchecked. أُعيد تشغيل الوظيفة الفاشلة وحدها في run `41038943236` للتحقق من التذبذب؛ كانت قيد التنفيذ عند تسجيل هذا التحديث. لا نعدل اختبار/مكوّن المحتوى المملوك لشريحة أخرى دون تسليم المالك.
- **تغيّر main:** أصبح `main@49de96956e1d10a830b1959bbd5dfd1e949035fb` بعد #253. المقارنة مع فرع PR تظهر 3 commits main-only في `.github/workflows/review-saved-http.yml` وتقرير الحادثة، دون ملف متداخل مع ملفات #254؛ لا نقل wholesale ولا force update.

## الخطوة التنفيذية التالية

انتظر بوابات exact-head على `453061f5`، وافحص E2E الفاشل السابق/إعادة التشغيل. إذا نجحت البوابات، يلزم مراجعة مستقلة وإثبات مستهلكات الطالب والهيدر قبل أي دمج؛ وإذا تكرر فشل المهارة، يُسلّم إلى مالك content/skill بدل تعديل ملفه من فرع Taxonomy.