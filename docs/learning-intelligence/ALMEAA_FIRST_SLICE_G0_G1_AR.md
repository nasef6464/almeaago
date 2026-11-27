# أول Work Order تنفيذي قابل للإغلاق — G0/G1

## لا تبدأ بإنشاء جداول عمياء
1. احصل على HEAD الحالي وCheckpoint/PRs/ملكية الملفات من Go، وقارن آخر نسخة Codax read-only في مسار نتائج/جاهزية الطالب.
2. اكتب Inventory محدد: هل يوجد جدول هدف ذو إصدار؟ من أين تأتي مهارات مقام الجاهزية؟ كيف تُربط نسخة السؤال بمهارة أساسية؟ ما مفاتيح Evidence idempotency؟ أين يُقرأ القرار حاليًا؟
3. قارِن دالة `MasteryReadinessFrom` وAPI `/api/v1/mastery/readiness` و`ReviewLibraryPage`, `SmartLearningPathWidget`, `StudentDashboardPage`, `StudyPlanPage`, و`reports`، وحدد أول خرق عقد ببيانات قابلة للتكرار.
4. اكتب اختبار RED لحالة هدف 10 مهارات منها 3 فقط لها تقدم؛ تحقق أن التغطية 3/10 دون عد رئيسي وفرعي مرتين. اكتب حالات NO_EVIDENCE، بنك فارغ، سؤال متعدد روابط، retry، اختلاف المسارات، وSTALE إن كان ضمن نطاقها.
5. نفّذ pure Go `EvaluateGoalReadiness` بحساب من published GoalSkillSet/PolicyVersion ومجموعة أدلة مؤهلة، مع reasons وmissingSkills وdataRevision. لا تغير `SkillStatus` ودرجات المحاولات القديمة بصمت. شغّل Shadow mode.
6. أضف schema فقط بعد اكتشاف الفجوة؛ إذا احتاج current/history، unique keyed UPSERT مع sparse history وrollback واختبار migration. لا تعدل production data.
7. اجعل الاستجابة بلا fallback مُلفق؛ لا تفتح محتوى غير منشور أو غير مستحق. حدّث OpenAPI/DTO ووثق التوافق قبل إضافة route جديد.
8. أثبت Go Unit + HTTP + PostgreSQL isolated + authorization negative، وثبت CI على SHA النهائي. إذا لم تشمل الواجهة الشريحة، اذكر أنها G2 لا G1، ولا تدعِ تكافؤ UI.
9. سلّم PR بنطاق صغير، وروابط الأدلة، وملخص واضح: ما عُدّل وما أُعيد استخدامه، ما لم يكتمل، وأول أمر الاستئناف.

**للمراجعة التربوية:** لا عتبات «80% / محاكيان / 21 يومًا» كسياسة نهائية بلا معايرة، ولا توقع درجات رسمية، ولا اعتبار غياب الدليل ضعفًا.

**للمراجعة الهندسية:** لا writer overlap مع Antigravity؛ لا Force Push؛ لا تعطيل اختبارات CI؛ لا دمج قبل البوابات؛ لا نشر إنتاج.