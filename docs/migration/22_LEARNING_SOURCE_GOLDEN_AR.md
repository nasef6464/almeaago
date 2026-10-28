# P1 — مقارنة سياسة التعلم بالمصدر القابل للتنفيذ

المصدر `almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`، أساس Go `1e45905ae1a3f25fff07f6efe16f637d5d369bb9`، فرع مستقل `audit/learning-policy-golden`. لا تغيير runtime أو schema أو بيانات أو عتبات أو واجهة.

## المنجز

- حفظ نسختين حرفيتين من TypeScript في `scripts/parity/learning-source`، وGit blob مطابق للمصدر: `skillAnalytics.ts` = `853e8461d2110931ce1c9c8d61982b5131d036b7`؛ `nextBestAction.ts` = `0ebf7b2a08011e8f9bd66aa90ff41b348ede54dc`.
- `learning-golden.mjs` ينفذ دوال المصدر مباشرة عبر Node الداعم لمحو أنواع TypeScript؛ لا يعيد صياغة خوارزميتها. ينتج JSON متكررًا ثابتًا مع SHA256 لكل ملف، 51 حالة مشتركة و12 ملاحظة adaptive.
- `TestLegacySkillPolicyGolden` يقارن ناتج Go الحقيقي بتوقعات المصدر المستقلة: 17 قيمة mastery ×3 قيم attempts، حول 45/50/65/75/80/90، بما فيها القيم الكسرية. **51/51 متطابقة** للتصنيف والتوصية النصية المشتركة فقط.
- اختباران للأداة: fixture مطابق، ورفض fixture مفقود/تالف. اختبار الرفض فشل قبل تنفيذ `--check` ثم نجح؛ هذا RED→GREEN للأداة، وليس دليل إصلاح runtime. أُضيف التحقق إلى Frontend CI القائم؛ Go golden يدخل Backend CI تلقائيًا.

## فصل العقود قبل إصلاح السياسة

| المسار | المصدر | Go | الحكم |
|---|---|---|---|
| تحديث تقدم المهارة → status/recommendedAction | `quizSubmissionSkillProgress` → `skillAnalytics` → Mongo SkillProgress | ApplyAssessmentEvidence/ApplyReviewAnswer → SkillStatus/RecommendedAction → PG skill_progress | VERIFIED للدوال المشتركة في 51 حالة؛ الكتابة والتقريب والتزامن ليست مثبتة بهذه الحالات |
| توصية تكيفية → كفاية الأدلة/اتجاهها | `nextBestAction::buildServerNextBestAction`: measure إذا evidenceCount<3؛ mastery_review من80؛ decline قد يغير الإجراء | GET mastery/next-action → Service.NextAction → WeakestSkillProgress SQL بترتيب mastery → recommended_action محفوظ | PARTIAL: ليست نفس خوارزمية الترتيب أو DTO. 12 observation من المصدر، لا ادعاء 12 مقارنة ناجحة |
| سياسة التقرير التعليمي | `learningEvidencePolicy`: minimumAnswers=5 ثم support<60 وready>=80 | readiness يستخدم reliable عند3 وscore موزون | UNKNOWN لتكافؤ هذا التقرير؛ عقد مختلف عن adaptive minimum3، فلا نستبدل 3 بـ5 آليًا |
| تغطية readiness | Go يجمع reliable/عدد progress rows المقروءة | لا taxonomy count في MasteryReadinessFrom | VERIFIED أنه مقام المهارات المقاسة؛ UNKNOWN أنه مقام كل المنهج. لا نحكم على طالب من مهارات لم تُقَس |

هذه المقارنة تمنع تغيير عتبات متطابقة أصلًا وتكشف موضع العمل الحقيقي. Source SkillProgress merge rounds إلى عدد صحيح؛ SQL Go يحتفظ بثلاث منازل. تطابق الدوال وحده لا يثبت تطابق مسار التخزين، ويحتاج حالات نصف الدرجة قبل أي تغيير.

## إعادة الإنتاج

`node --experimental-strip-types scripts/parity/learning-golden.mjs --check`

`node --experimental-strip-types scripts/parity/learning-golden.test.mjs`

`go test ./internal/learning/domain -run TestLegacySkillPolicyGolden -count=1 -v`

`go test ./...`

تحديث المصدر يتطلب فحص SHA جديد، جلب الملفين، تشغيل generator إلى fixture، ومراجعة كل فرق؛ لا regenerate تلقائيًا في CI لإخفاء تغير السياسة. لا حاجة للوصول للإنتاج أو MongoDB. الخطوة التالية: trace endpoint الحقيقي الذي يستهلك adaptive في Legacy، مع golden رتبة/إجراء/نطاق متعددة المهارات وقرار مقام المنهج، ثم إصلاح Go المناسب؛ لا نسخ عتبات عمياء أو استبدال صلاحيات/DTO بصمت. شريحة المدارس #144 تُترك لصاحبها.
