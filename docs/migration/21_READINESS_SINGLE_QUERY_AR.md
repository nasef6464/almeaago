# P1 — قراءة جاهزية واحدة متسقة

التاريخ: 2026-10-28. المصدر: `almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`؛ أساس Go: `778be2c1aa361513a769845dfa0bf3f37a7e0cba` (#143).

## المسار المثبت بالكود

الطالب → `ReviewLibraryPage` → `learningClient.readiness` → GET `/api/v1/mastery/readiness` → HTTP `readiness` → `Service.Readiness` → `Repository.ListSkillProgress` → PostgreSQL `skill_progress`.

القراءة تقيد `student_id + path_id` و`subject_id` عند تحديد المادة. معادلة `MasteryReadinessFrom` وDTO والصلاحيات والقائمة العادية لم تتغير.

## الخلل والحل

بعد #143 أصبح التكرار مرفوضًا، لكن تحديث mastery بين استعلامي OFFSET قد يتسبب في فقد صف دون تكرار. الآن يطلب التطبيق الصفحة الأولى فقط بحد 10000؛ الاستعلام الموجود يجلب 10001 صفًا لاكتشاف الزيادة. بذلك تعتمد جميع الصفوف على snapshot استعلام PostgreSQL واحد. `HasMore` أو نتيجة أكبر من الحد تفشل بـ`ErrIncompleteReadiness`، دون تجميع صفحات لاحقة. يحتفظ التحقق برفض التكرار والنطاق الأجنبي.

الحد لم يتغير: 100 صفحة ×100 سابقًا، و10000 في قراءة واحدة الآن. لا migration أو تعديل بيانات أو عتبات.

## الدليل والقيود

- اختبارات RED أظهرت limit=100 بدل 10000، و100 قراءة عند overflow، وقبول 10001 صف من adapter غير ملتزم.
- GREEN: اختبارات learning وكل `go test ./...` محليًا نجحت. حالات: 101، صفر، 10000، 10001، query error، إلغاء مسبق ومتأخر (اختبار RED→GREEN بعد مراجعة مستقلة)، تكرار، نطاق أجنبي، نفس skill ID في مادتين.
- أضيف `TestReadinessSingleQueryPostgres` إلى Database CI: جدول مؤقت ينسخ أعمدة المخطط المهاجر، ويمرر SQL الحقيقي ثم الخدمة مع 0/101/10000/10001 وعزل الطالب/المسار/المادة. لا يفحص قيود FK أو مسار كتابة evidence؛ لا سجلات طلاب دائمة. **تشغيله الحقيقي ينتظر CI؛ محليًا skipped لغياب DATABASE_URL.**
- الحالة `PARTIAL`: لم تثبت مطابقة Legacy للمعادلة أو مقام المهارات غير المقاسة أو الأداء تحت حمل إنتاجي. الاتساق هنا لصفوف progress المقروءة فقط؛ لا ادعاء snapshot واحد عبر taxonomy أو أن أدلة محاولات متزامنة كُتبت ذريًا.
- لا تغيير واجهة مرئية؛ لا شهادة visual parity أو نقل كامل أو نشر إنتاج.

التالي: exact-head Backend/Database/Frontend/E2E CI، ثم golden comparisons للمقام والسياسة التعليمية على fixtures آمنة. شريحة school-definition الجارية في فرع آخر لا تُدمج بالجملة ولا تُكرر.
