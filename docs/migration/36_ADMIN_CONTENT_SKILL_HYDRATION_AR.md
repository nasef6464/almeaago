# ADMIN-CONTENT-SKILL-HYDRATION-01 — روابط مهارات المكتبة والتأسيس

**الحالة:** IMPLEMENTED / CI PENDING؛ التطابق البصري والرحلة الحية إلى PostgreSQL **PARTIAL / NOT PROVEN**.

## المصدر والملكية
- Legacy read-only: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- الفرع: `fix/admin-content-skill-hydration-20261029`، Draft PR #167.
- PR #160 يملك مركز المهارات المستقل والدروس، وPR #159 يملك الهيدر؛ لا تعديلات على ملفاتهما.
- عقد Legacy: `dashboards/admin/LibraryManager.tsx` و`FoundationManager.tsx` يحتفظان بروابط المهارات عند فتح تعديل العنصر، ولا يعتبران تأخر تحميل الفهرس طلبًا بفصل المهارات.

## الفجوة المثبتة من الكود
1. `LibraryEditorPanel` و`FoundationEditorPanel` يطلبان تفاصيل العنصر وفهرس `taxonomyFull` بصورة مستقلة.
2. إذا وصلت التفاصيل أولًا، تُملأ `skillIds` من الخادم، ثم تُشغّل `useEffect` التي ترشحها ضد `taxonomy.skills=[]` المبدئية؛ فتُمحى الروابط من المسودة بصمت.
3. كان يمكن أن يفقد المدير المهارات الظاهرة عند حفظ تعديل غير مرتبط بالمهارات. يرفض Go القائمة الفارغة، لكن هذا لا يبرر إسقاطها في واجهة التعديل.
4. نموذج إنشاء الدورة يملك مخاطرة مماثلة عند تهيئة مسار/مادة مسبقًا قبل اكتمال الفهرس.

## التنفيذ المحفوظ
- عدم تصفية الموضوع أو المهارات إلا بعد **نجاح** تحميل `taxonomyFull`، وليس بعد انتهاء طلب فاشل.
- منع الحفظ عندما لا يتوفر فهرس صالح؛ مع الاحتفاظ بقيم النموذج ومسودته.
- تطبيق الحماية في `LibraryEditorPanel` و`FoundationEditorPanel` و`CourseCreatePanel`، بلا تغيير ترتيب أو عناصر الواجهة ولا عقد API ولا قاعدة البيانات.
- تثبيت عقد Go: `UpdateLibraryItem` و`UpdateTopic` يحافظان على `skillIds` و`expectedRevision`، ويرفضان الروابط الفارغة.
- لا تغيير RBAC أو scoring أو payments أو production.

## التحقق المطلوب/حدوده
- اختبار Playwright `admin-content-skill-hydration.spec.ts`: تفاصيل العنصر تصل قبل فهرس المهارات؛ حفظ يفشل 503؛ تبقى المسودة والمهارة محددة؛ إعادة المحاولة تحمل نفس `skillIds`؛ إعادة تحميل المكتبة والرجوع في التأسيس. المقاسات 390/820/1440.
- اختبار Go `TestAdminLibraryAndFoundationSkillLinkRoundTrip`: application→repository stub؛ لا يمثل PostgreSQL الحقيقي.
- بوابات GitHub المطلوبة على **SHA النهائي**: Backend CI وFrontend CI وDatabase CI وFrontend E2E. تُقرأ نتائجها من PR #167؛ لا تُستنتج من مجرد فتح PR.
- الاختبار البصري يلتقط شاشة Go فقط؛ لم تتوفر هنا جلسة Legacy بنفس البيانات لصور مقترنة. لذلك لا شهادة تكافؤ بصري.
- Database CI يختبر migrations وتكاملات PostgreSQL القائمة؛ لا يوجد في هذه الشريحة اختبار PostgreSQL حي مخصص لروابط المكتبة/التأسيس.

## الفروق الباقية والخطوة التالية
- Legacy `LibraryManager` يعرض مهارة رئيسية ثم فرعية، بينما Go الحالي يكتفي بقائمة مهارات مسطحة؛ **PARTIAL**، يلزم عقد تصنيف وربط ومقارنة شاشة كاملة قبل التعديل.
- Legacy `FoundationManager` يتعامل مع دروس وتدريبات وملفات دعم، بينما Go هنا يربط الدروس والمكتبة؛ التدريب/الاختبار ضمن الفجوات التي تحتاج شريحة مستقلة مع مالك assessment.
- استكمال اختبار HTTP حقيقي بجلسة مدير/غير مدير وقاعدة PostgreSQL معزولة، ثم صور Legacy↔Go متطابقة الدور والبيانات والمقاس، وتقييم نشر المحتوى للطالب.
- لا دمج أو نشر قبل قرار مستقل.
