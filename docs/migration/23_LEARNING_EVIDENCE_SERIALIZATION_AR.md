# P1 — سلامة حفظ أدلة الإتقان المتزامنة

**الحالة:** IMPLEMENTED / GREEN CI مطلوب؛ ليس اعتماد إنتاج أو تكافؤ شامل.
**المصدر:** `almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`؛ فُحص main عبر Git في هذه الجلسة.
**أساس Go:** `935998650d2183bd9a8c95c154384ff4754b3197`؛ #145 و#146 مدمجان ولا يعاد تنفيذهما. **PR:** #148.

## الفجوة ومسارها

| فعل الطالب | الواجهة/API | الخدمة | PostgreSQL |
|---|---|---|---|
| تسليم اختبار | attempt-client.submit → POST /api/v1/assessment-attempts/{id}/submit | AttemptService.Submit → LearningSubmissionEvidence → Service.ApplyAssessmentSubmission → ApplyAssessmentEvidence | mastery_evidence → mastery_evidence_skills → skill_progress؛ review_cards/review_card_skills |
| إجابة مراجعة | learning-client.answerReview → POST /api/v1/review/cards/{cardId}/answer | Service.SubmitReviewAnswer → ApplyReviewAnswer | review_answer_submissions → mastery_evidence → mastery_evidence_skills → skill_progress؛ جدولة review_cards |

المساران يكتبان الدليل ثم يقرآن aggregate مستقلًا قبل upsert للتقدم. تحت READ COMMITTED قد يقرأ كل طلب دليله فقط، ثم تنتظر الكتابة قفل صف التقدم، وتكتب قيمة محسوبة قبل اكتمال الطلب الآخر. حفظ صفّي دليل لا يضمن أن evidence_count/mastery/status/recommended_action تعكسهما. قفل بطاقة مراجعة واحدة لا يحمي بطاقتين مختلفتين أو مسار الاختبار.

## قرار التنفيذ المفوّض

قفل PostgreSQL advisory داخل transaction، بمفتاح طالب UUID موحد وnamespace learning-evidence، قبل قراءة idempotency أو أي كتابة/قفل بطاقة. يشارك فيه المساران. الطالب الآخر مستقل؛ طلبات الطالب نفسه تتسلسل حتى إن اختلف المسار/المادة، لتوحيد ترتيب أقفال البطاقات والمهارات.

اختيار قفل لكل مهارة يتطلب معرفة كل المهارات قبل قفل البطاقات وترتيبها ومعالجة أول insert؛ SERIALIZABLE يحتاج سياسة إعادة محاولات أوسع. القرار المحدود يفضّل صحة التقدم مع اختبار التداخل الفعلي؛ **الكلفة:** يقل توازي كتابات الطالب نفسه، والأداء الإنتاجي غير مقاس. READ COMMITTED صريح حتى تقرأ العبارات التالية اكتمال المعاملة السابقة بعد انتظار القفل.

لا تغيير معادلة أو عتبة أو تقريب أو درجات أو API أو schema، ولا إعادة حساب سجلات تاريخية. لا استدعاء خدمة خارجية أو كتابة Legacy/production.

## الإثبات وحدوده

اختبار `TestEvidenceSerializationPostgres` ينسخ شكل الجداول المهاجرة وقيودها وفهارسها إلى schema مؤقت مستقل، دون نسخ foreign keys؛ لا يمثل ذلك اختبار lifecycle كامل للاختبارات أو الصلاحيات. trigger اختباري يوقف INSERT للتقدم **بعد** SELECT للتجميع؛ مراقبة pg_stat_activity تثبت انتظار طلبين، ثم يسمح لهما بالاكتمال. لا تعتمد صحة التداخل على sleep.

الحالات: assessment/assessment، assessment/review، review/review، إعادة review متطابق، إلغاء طلب منتظر؛ إعادة المحاولات لا تزيد عدد الأدلة، وطلب طالب آخر يكتمل أثناء توقف الطالب الأول. PostgreSQL الفعلي مطلوب؛ تشغيل Go دون DATABASE_URL يتجاوز هذه الحالات ولا يُحسب إثباتًا لها.

محاولة تجهيز PostgreSQL محليًا كشفت قيد هوية المستخدم/ملكية الملفات في البيئة؛ جرى استخدام قاعدة PostgreSQL 18 المعزولة في Database CI القائم بدل تغيير النظام أو إضعاف الاختبارات. الاختبارات المحلية الكاملة وsource oracle نجحت قبل الإصلاح؛ نتيجة PostgreSQL تسجّل بعد التنفيذ.

**متبقٍ:** مقارنة التقريب وتجميع الأدلة المتتابعة مع المصدر؛ مقام المنهج والتوصية التكيفية؛ تصوير واجهات الأدوار؛ قياس الأداء وحالات live. المصدر يدمج إتقانًا مقربًا من السابق، بينما Go يعيد تجميع الأدلة الخام؛ تغيير ROUND فقط لا يثبت التكافؤ.

## RED المثبت

على `7e0d104317eeed6050033c3d193ae5bc00666ef6`، [Database CI 40679673484](https://github.com/nasef6464/almeaago/actions/runs/40679673484) فشل كما هو متوقع: ثلاث حالات أعادت progress=1/attempts=1/persisted=2/mastery=0 بدل count=2/mastery=50، وإعادة المراجعة المتطابقة رجعت conflict. حالة الإلغاء نجحت قبل الإصلاح؛ ليست إصلاحًا جديدًا. أُضيف القفل بعد قراءة السجل الفعلي، ثم ينتظر GREEN على النسخة النهائية.
