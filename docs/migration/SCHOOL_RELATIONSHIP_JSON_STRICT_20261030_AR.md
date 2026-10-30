# المدارس والأدوار — حراسة طلبات تغيير العلاقات المدرسية

**التاريخ:** 2026-10-30. **النطاق:** شريحة مستقلة ضمن خطة `03_EXECUTION_AND_HANDOFF_PLAN_AR.md`؛ ليست شهادة تكافؤ واجهات المدارس.

## المرجع والملكية

- Legacy للقراءة فقط: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- التنفيذ: Draft PR #239، فرع `fix/schools-strict-relationship-json-20261030-0752`.
- لا تغيير في واجهات #162 (ولي الأمر) أو #172 (مدير المدرسة) أو #208 (اختبارات الجدول) أو #144 (تعريف الاختبار) أو في RBAC/assessment/scoring/schema.

## الفرق المثبت

`internal/organizations/transport/http/handler.go::decodeJSON` كان يفك أول مستند JSON فقط دون اختبار انتهاء جسم الطلب. عند إرسال مستند ثانٍ أو نص لاحق، تستمر عمليات تغيير membership وdirector وteaching assignment وفق المستند الأول فقط، رغم تعارض الجسم الكامل. هذا عيب سلامة طلب HTTP؛ ليس استنتاجًا من صورة UI.

## trace ونطاق الإصلاح

`school admin → membership/director/assignment PUT → organizations HTTP (canonical + legacy facade) → decodeJSON → application → repository`.

عند مستندين أو نص زائد: 400 `Invalid request` قبل استدعاء application/repository. عند مستند واحد مع مسافات بيضاء لاحقة: يحافظ على السلوك الصحيح. لا تغيير في قرارات CSRF/auth/RBAC، أو هوية العلاقات أو صلاحياتها أو حفظها أو صيغ استجابات النجاح.

## RED→GREEN

- **RED**: اختبار `TestSchoolRelationshipWritesRejectTrailingJSONWithoutMutation` يغطي ستة مسارات × حالتي مستند ثانٍ ونص زائد؛ على الرأس `28ea9860e993900f078aa0ca2109d30580f9380c` فشل Go في Backend CI كما هو متوقع: عادت استجابات 200 بدل 400. الدليل: https://github.com/nasef6464/almeaago/actions/runs/41005478943
- **GREEN**: يضيف الإصلاح شرط `io.EOF` بعد فك المستند الأول. اختبار whitespace يحمي النجاح الأصلي. **GREEN** على `50f58113192064bb5b1b4c7372fb2d584235e913`: نجحت بوابات [Backend](https://github.com/nasef6464/almeaago/actions/runs/41005611381)، [Frontend](https://github.com/nasef6464/almeaago/actions/runs/41005611367)، [Database](https://github.com/nasef6464/almeaago/actions/runs/41005611444)، [Browser](https://github.com/nasef6464/almeaago/actions/runs/41005611353). نتائج CI تخص هذا الإصلاح فقط؛ لا تثبت التكافؤ البصري أو التخزين الحقيقي لهذه الرحلة.

## مصفوفة القبول

| الشرط | الحالة |
|---|---|
| رفض مستند JSON ثانٍ قبل كتابة العلاقات | VERIFIED — RED→GREEN وBackend CI |
| رفض trailing garbage قبل كتابة العلاقات | VERIFIED — RED→GREEN وBackend CI |
| بقاء المستند الواحد والمسافات البيضاء صالحين | VERIFIED — RED→GREEN وBackend CI |
| الاحتفاظ بالـauth/CSRF/RBAC والردود الأصلية | PARTIAL: الاختبارات الموجودة، لا تغيير في الكود |
| حفظ علاقة حقيقية في PostgreSQL ثم قراءة المستهلك بعد reload | NOT PROVEN |
| صور Legacy↔Go بنفس الدور/البيانات عند 390/820/1440 RTL | NOT PROVEN |
| تكافؤ واجهات المدير والمعلم والمشرف وولي الأمر | PARTIAL / NOT PROVEN |

## التالي دون ازدواج

ملفات جدول مدير المدرسة واختبارات #208 مملوكة لفرق أخرى. لا تُعدل من هذا الفرع. بعد حسم ملكيتها، اختبر `مدير المدرسة → نقل الطالب → HTTP → Go → PostgreSQL → إعادة تحميل الجدول`، بما فيها 503/403/409 والرجوع والمسودة، ثم أزواج صور 390/820/1440. افصل membership عن assignment وعن entitlement، ولا تكرر محرك الاختبارات الموحد.
