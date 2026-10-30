# اختيار توصية الطالب وفق أولوية المصدر — 2026-10-28

## النطاق

دفعة وظيفية لاختيار وعرض التوصية الواحدة في مكتبة مراجعة Go الحالية. المصدر للقراءة فقط bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7؛ قاعدة Go cfdae71577188294f589e127ce9198dd75836777. PR149 يستأنف اختبار المصدر المحفوظ، ولا يعيد #145/#146/#148 أو يلمس #144.

طالب → `/review` أو alias `/favorites` → learningClient.nextAction → GET `/api/v1/mastery/next-action` → Service.NextAction (student + path required + optional subject) → PostgreSQL WeakestSkillProgress → RankAdaptiveProgress → `{item}` → بطاقة الخطوة التالية. لا خدمات خارجية أو كتابة بيانات في هذا المسار.

## التنفيذ

- قراءة واحدة في MVCC snapshot: أول100 مهارة وفق ترتيب المصدر mastery ASC / last evidence DESC. إضافة معرف المهارة والمادة كفاصل تعادل حتمي؛ لا ترتيب موثوق لتعادل Mongo الأصلي.
- سجل الاتجاه من آخر5 أحداث مصدر لكل طالب/مسار/مادة/مهارة، يحسب نسبة صحة أسئلة الحدث الواحد ثم يقارن أول/آخر حدث؛ لا يخلط الأسئلة داخل محاولة واحدة مع محاولات مستقلة ولا يستخدم الإتقان التراكمي بدل دليل الحدث. مرجع المصدر `quizSubmissionSkillProgress.ts` و`mergeRecentSkillEvidence` (النافذة الافتراضية5).
- الأولوية: الحاجة للإتقان + وزن الحالة weak30/average15 + الاتجاه declining18/improving−6 + الأدلة الأقل من3 بوزن12 + قدم الدليل بالأيام/14 بحد10. ترتيب التعادل ثابت؛ أربعة مرشحين داخل الدومين، ثم تعاد التوصية الأولى للمستهلك الحالي.
- الإجراء: measure إذا evidence<3، mastery_review عند mastery>=80، alternate_support_then_recheck عند mastery<50 أو اتجاه هابط، وإلا remediation_then_recheck. هذه سياسة توصية فقط؛ لا تغيير في درجات أو حالات الإتقان أو النص المخزن في skill_progress.
- `{item}` محفوظ، مع حقلي action/trend اختياريين إضافيين. الواجهة تعرض إتقان «المهارة المختارة» واتجاه الأدلة، وتخفي التوصية السابقة عند تحميل نطاق جديد وتتجاهل الطلب الملغى.

## أدلة الاختبار

VERIFIED: فشل الاختيار القديم على PostgreSQL في خمس حالات فعلية (status/evidence/recency/trend/scoped history)، اختار mastery59 بدل الأولوية mastery60. الرأس RED a2535a880e970e01f3d4f2c07ddeb44bbe8bd341: https://github.com/nasef6464/almeaago/actions/runs/40728662131 .

VERIFIED: 69 حالة fixed-clock مولدة بتشغيل `nextBestAction.ts` نفسه (blob0ebf7b2a08011e8f9bd66aa90ff41b348ede54dc) وتقارن ترتيب IDs/action/trend/mastery/evidence مع Go؛ حارس strict blob وحارس fixture drift ضمن Frontend CI. محليًا go test ./... وgo vet وfrontend build واختبارات المصدر. اختبارات PostgreSQL المحلية تُتخطى لغياب DATABASE_URL؛ لا نعدها نجاح DB.

VERIFIED على الرأس الوسيط4fec848b7257c5f98ac7be948049b522163bffa3: Backend/Frontend/Database؛ اختبارات PostgreSQL تمر عبر repo/application/HTTP مع عزل تاريخ الطالب والمسار والمادة، guards403/400، empty item، cancellation، وعدم تعديل النص المخزن. تشغيل DB https://github.com/nasef6464/almeaago/actions/runs/40729678274 .

بوابات SHA النهائي والمراجعة المستقلة ولقطات390/820/1440: تُثبت نتائجها وروابطها في وصف PR149 بعد اكتمالها؛ نجاح الرأس الوسيط لا يكفي للدمج. اختبارات إضافية في الرأس النهائي لآخر5 أحداث وتجميع أسئلة الحدث، timestamp مفقود، first100، ومادة اختيارية. اختبار المتصفح يقبل استجابة recommendation ويتحقق من العرض وتغيير النطاق؛ ليس متصفحًا موصولًا بقاعدة فعلية.

## القرارات والحدود

اختير الحفاظ على endpoint/DTO الحالي وتوسعة item بدل استبداله بعقد Legacy كامل؛ كلفة القرار أن استجابة المرشحين الأربعة وfingerprint/ETag وروابط إجراءات Legacy ليست منجزة بهذا التغيير. إعادة بناء سجل الأحداث من الأدلة تحافظ على النتائج المخزنة ولا تتطلب migration؛ الأداء الإنتاجي وبيانات Mongo القديمة والتعادل في نفس الزمن تحتاج تحققًا منفصلًا. الترتيب والتوصية في الدفعة قابلان للاختبار؛ التكافؤ البصري الكامل للمكتبة وبقية رحلات adaptive ليسا مثبتين.

لا نشر أو أسرار أو إنتاج أو كتابة للمصدر. التالي بعد دمج هذه الدفعة: عقد الإجراء التنفيذي من التوصية إلى التدريب/الدعم وإعادة القياس، مع مقارنة روابط ومستهلك Legacy؛ لا إعادة جرد من الصفر.
