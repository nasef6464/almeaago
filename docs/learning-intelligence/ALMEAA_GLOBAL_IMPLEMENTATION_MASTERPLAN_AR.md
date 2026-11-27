# ALMEAA | الخطة التشغيلية والهندسية والتربوية الموحدة — Learning Decision Intelligence

**الإصدار:** 1.0 — 25 نوفمبر 2026  
**النوع:** وثيقة تسليم تنفيذية لأي وكيل؛ ليست شهادة تنفيذ أو نشر؛ **تابعة** للخطة الحاكمة في المستودع وليست خارطة تنفيذ رئيسية ثانية.  
**الهدف:** بناء نظام ذكاء تعلم وقرار وتحسين رياضي عام لكل مسارات ومواد ومهارات المئة، يستثمر الأنظمة القائمة ويظهر أثره لكل دور.  
**مستودع التنفيذ الوحيد:** `nasef6464/almeaago` (Go + PostgreSQL + Redis + React/Vite).  
**مرجع تجربة المستخدم:** `nasef6464/almeaacodax` قراءة ومقارنة فقط.  
**الحاكم:** `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md` + آخر `AGENTS.md` و`CHECKPOINT_AR.md` + `OWNER_BATCH_DELIVERY_CONTRACT_AR.md` + `ANTIGRAVITY_EXECUTION_STANDARD_AR.md` + المحاور A–H.

> تنبيه مهم: هذه الوثيقة **تصف ما يُنفَّذ**. لا يُعد أي جدول أو API أو واجهة فيها موجودًا فعليًا دون إثبات من المستودع الحالي. إذا تعارضت مع كود أحدث أو Checkpoint صحيح، فحص المصدر والاختبارات الحالية يحسم. لا تُنسخ الخطة إلى repo كخطة ثانية؛ تُربط المهمة في سجلات التنفيذ الحالية.

## 0. ملخص القرار ونقطة البداية المحققة

- بناء النظام داخل Go، وليس Codax؛ لا إعادة كتابة عامة ولا نسخ `assessment` أو `mastery` أو `study_plans` أو `reporting` أو الصلاحيات.
- نبدأ من **الثقة في الأدلة والتغطية والجاهزية**، ثم نصلها بواجهة الطالب، ثم المدرسة والأدوار، ثم مالك المنصة، ثم التحسين المقيد المعقد.
- **المحرك لا يملك التصحيح ولا الاستحقاق ولا النشر ولا التنبؤ بدرجات رسمية غير معايرة.**
- الاستمرار في هجرة Codax له الأولوية وفق الخطة الموحدة؛ شريحة الذكاء الجديدة معزولة بملكية ملفات واضحة.
- من فحص GitHub في جلسة 25 نوفمبر 2026: آخر commit مرصود في المستودع `12b642b81e3f7b1cb9d5c2afa9fa90ddfa83fe21`، ويظهر دمج استعادة نتائج الطالب في #301، وإصلاح معلم في #304؛ وPR #280 مغلق. **هذه لقطة قابلة للتغير، ويجب تحديثها قبل أول كتابة**. لا تتعامل مع توجيه PDF القديم «PR #280 مفتوح» كحالة حالية.
- `internal/learning/domain/learning.go` يحوي `MasteryReadinessFrom` وأنواع أدلة ومؤشرات تقدم مهارة؛ `apps/web/src/features/learning/pages/StudentDashboardPage.tsx` يحوي مسارًا ذكيًا وخططًا وتقارير؛ `ReviewLibraryPage.tsx` يقرأ الجاهزية؛ `StudyPlanPage.tsx` يحوي خطة؛ `SchoolInterventionsPage` موجود. هذه **نقاط مراجعة/إعادة استخدام** وليست شهادة صحة كل سلوك.
- فحص `SmartLearningPathWidget.tsx` أظهر خطوات افتراضية؛ وفحص `ParentDashboardPage.tsx` أظهر مصفوفة موافقات تجريبية ونصًا يقترح عتبة إتقان ثابتة؛ يجب تدقيق كل قيمة Mock/Fallback/Hardcoded قبل ربط القرار الجديد.
- ADR-0008 يسجل اتجاه OR، لكن عبارتي «مطابقة 100% لقياس» و«<10ms» و«التحسن المتوقع في الدرجة الرسمية» **وعود غير مثبتة**. يجب تعديل صياغة الادعاءات في نطاق PR حوكمة صغير، مع الاحتفاظ بالقرار الهندسي المقبول.

## 1. ميثاق المنتج: لماذا نفعل ذلك؟

**North Star:** «كل طالب يعرف ماذا تعلم، وما الذي لم نعرفه عنه بعد، وما أقصر خطوة صحيحة ينبغي أن يفعلها الآن، ثم يرى الدليل على تحسنه». وعندما يستخدمها المعلم أو ولي الأمر أو المدرسة أو مالك المنصة، يرى كل منهم نفس الحقيقة بالقدر الذي يحق له، فيقرر إجراء مناسبًا دون تفسير مضلل أو ازدواج.

**حلقة واحدة:** تعريف هدف مهاري → دليل موثوق من سؤال ونسخته → تشخيص وإتقان وتغطية → قرار جاهزية مفسر → نشاط/خطة/تدخل ضمن الصلاحيات والموارد → تعلم/تدريب → قياس مستقل جديد → تحديث القرار → تقييم جودة السياسة والتدخل.

**منتج متعدد الأسواق:** B2C للأفراد وB2B للمدارس؛ المسارات الاختبارية والمدرسية واللغات وغيرها؛ لا `switch` باسم QUDRAT/TAHSILI داخل الحساب. سياسة هدف قابلة للإصدار + تصنيف منشور + سؤال/محتوى مرتبط = توسيع من دون إعادة كتابة النواة.

**مبادئ لا تُكسر:**
1. الـLegacy مرجع الشاشات والوظائف؛ الـGo مصدر التنفيذ؛ لا redesign صامت.
2. السؤال له أصل ونسخة وهوية، ولا ينسخ إلى كل اختبار أو تقرير. تصحيح الخادم ونتيجته التاريخية ثابتان.
3. المهارة وحدة قياس؛ الرئيسي تجميع واضح من الفرعي، لا دليل مضاعف؛ العلاقات الثانوية للسؤال معلومات مساعدة حتى تعتمد سياسة attribution علمية.
4. `student + path + subject + skill` هو نطاق تقدم المهارة؛ لا تبادل إتقان تلقائي عبر مسارات مختلفة.
5. «لم يُقَس» ≠ «ضعيف»، «نشاط مكتمل» ≠ «إتقان»، «محاكي المئة» ≠ «نتيجة رسمية».
6. المصدر والسياق والفترة وإصدار الهدف ودليل الاستحقاق والإذن تسبق أي إجراء.
7. البساطة للطالب: بطاقة واحدة وخطوة واحدة ظاهرة، وتفاصيل قابلة للفتح عند الطلب.
8. الإنسان يعتمد النشر والتدخلات المؤثرة ويستطيع مراجعة/رفض اقتراح المحرك.
9. الخصوصية والإنصاف والتكلفة والأداء جزء من شروط القبول وليست تحسينات مستقبلية.
10. لا نجاح بلا أثر حقيقي في Go/PostgreSQL/React ودليل E2E وCI على الرأس النهائي.

## 2. كتالوج المكونات الموجودة التي نراجعها قبل اختراع بدائل

| المجال | ما نراجعه/نعيد استخدامه في Go | الحكم الملزم |
|---|---|---|
| التصنيف | `internal/taxonomy` وواجهات الإدارة للمسارات والمواد والمهارات | كل مهارة في هدف منشور معروفة حتى لو لا سجل تقدم |
| السؤال | `questionbank`، `QuestionVersion`، روابط المهارات ووسائط R2 | دليل مرتبط بالنسخة والمهارة عند التسليم |
| الاختبار | `assessment` ومحاولات النتائج والمحاكي والمدرسي والذاتي | لا تعديل للتصحيح ولا إعادة نشر تاريخي |
| الإتقان | `learning`, `mastery_evidence`, `skill_progress`, `MasteryReadinessFrom` | إضافة سياسة جاهزية هدف منفصلة، مع الحفاظ على المستهلكين الحاليين |
| التعلم | التأسيس و`topic_skill_links` والتدريب والمراجعة وSM-2 | التوصية بمواد منشورة ومسموحة فقط |
| الخطة | `StudyPlanPage`, `study_plans` وعقودها | تحسين جدول موجود وليس إنشاء نظام «خططي 2» |
| المدرسة | `organizations`, SchoolInterventions, SchoolDirector, Supervisor, Teacher | عزل الطالب/الفصل/المادة/المدرسة والاعتماد البشري |
| الأسرة | `ParentDashboardPage` وعلاقات الأبناء | لا حسابات/بيانات افتراضية كمصدر بيانات حقيقي |
| الإدارة | `AdminDashboardShell` و`/admin-dashboard/reports` | إضافة قسم مندمج لا Dashboard عمومية ثانية |
| التقارير | `reporting`، الفلاتر والتصدير القائم | مقام موحد مع فصل B2C/B2B والمصدر والفترة |

**مصفوفة الجرد:** `EXISTS_VERIFIED | EXISTS_PARTIAL | MISSING | UNKNOWN | BLOCKED`، ولكل وظيفة: Legacy route, React component, API, handler, tables, auth, tests, screenshots, owner, latest SHA. لا تُصنف «مفقودة» قبل تتبع عقدها.

## 3. لغة البيانات والتعليم (Domain Contract)

`Path → Optional Level/Stage → Subject → Main Skill → Optional Subskill`.  
كل سؤال معتمد له **مهارة قياس أساسية** داخل المادة والمسار عند إصدار السؤال؛ إذا كشف الجرد أن النماذج الحالية متعددة المهارات، يُصمَّم ترحيل إضافي وتوافق، ولا تفرض قيمة جديدة بكسر النتائج القديمة. علاقة الموضوع/الدرس/التدريب بالمهارة مستقلة عن شجرة المهارات. المتطلبات السابقة مهارات → مهارات في DAG لا يسمح بدورات.

**هدف التعلم Versioned Goal:** `(scope, path, subject[s], required_skill_leaves, weights, critical_skills, min_evidence_policy, valid_sources, currency_window, independent_rechecks, timed_conditions, access/assessment_blueprint, status, version, effective_dates, approvals)`. إذا لا توجد أوزان معتمدة، استخدم سياسة موصوفة ولا تدّعِ أنها رسمية. هدف المدرسة لامتحانها مستقل عن هدف اختبار خارجي أو هدف إتقان مادة، ولو اشتركت المهارات.

**سجل دليل مهاري مؤهل** يرتبط بـ `student/attempt/question/version/primary_skill/path/subject/source_kind/assist_level/occurred_at/family/session/evidence_id/data_revision`، مع منع التكرار ومنع double count. لكل مصدر (اختبار رسمي داخلي/محاكي/تشخيص/إعادة قياس/تدريب مدعوم/حصة) سياسة أهلية ونسبة ثقة مميزة. من حيث الملكية، لا ينعكس تعلم ذاتي على سجلات المدرسة إذا العقد والإذن لا يسمحان.

**حالات معرفية منفصلة:** `NOT_MEASURED`, `INSUFFICIENT_EVIDENCE`, `MEASURED_WEAKNESS`, `BUILDING`, `MASTERED`, `STALE_EVIDENCE`, `BLOCKED_BY_CONTENT`, `NOT_APPLICABLE`, `UNKNOWN/ERROR`. حالات *الجاهزية للهدف* ليست بالضرورة نفس حالات المهارة: `NEEDS_MEASUREMENT`, `NEEDS_FOUNDATION`, `NEEDS_PRACTICE`, `READY_FOR_RECHECK`, `READY_FOR_GOAL`, `UNKNOWN/STALE`؛ تحددها سياسة معتمدة، ويأتي معها `reason_codes`, `missing_skills`, `next_action`, `policy_version`, `goal_version`, `evaluated_at`, `data_revision`, `evidence_cutoff`.

**ثبات التاريخ:** اختبار قديم يبقى مصححًا ومحللًا وفق نسخته؛ تغيير الخريطة أو السياسة ينتج إصدار قرار أو إعادة تقييم معلنة، ولا يعيد كتابة الدرجات الرسمية. خيارات «اعتماد التعديل» و«محاكاة أثر السياسة» في الإدارة لا تمس نتائج المحاولات.

## 4. رياضيات القياس (ليس OR بعد)

### 4.1 تغطية الهدف المنشور

إذا كانت المهارات **الورقية/leaf** المطلوبة `G_v` والأوزان المعتمدة `w_i>0`، وكان `I_i=1` حين يكون للمهارة دليل مؤهل كافٍ وحديث:

`Coverage(G_v) = [ Σ_{i∈G_v} w_i I_i ] / [ Σ_{i∈G_v} w_i ]`.

لا نضاعف الرئيسية والفرعية في المقام؛ إذا كانت الرئيسية قابلة للقياس مباشرة، عرّفها كعنصر منفصل بسياسة صريحة لا تعيد استخدام نفس الإجابة. يمكن أن تظهر تغطية جزئية للعرض، لكن **بوابة الجاهزية** تستخدم قاعدة كفاية أدلة معلنة.

### 4.2 الإتقان والدليل

في أول مرحلة، نُبقي حساب mastery الحالي للمستهلكين ونعرض معه `measurement_quality`. لا نستبدله سرًا. عند اختيار نموذج تجريبي قابل للتفسير مثل Beta-Binomial على أدلة مؤهلة مستقلة:

`alpha_i = alpha0 + Σ_e weight_e * correct_e`،  
`beta_i = beta0 + Σ_e weight_e * (1 - correct_e)`،  
`posterior_mean_i = alpha_i/(alpha_i+beta_i)`.

**هذه صياغة تجريبية لا تعني احتمال إتقان معايرًا**؛ حساب الأصناف المرجعية/العائلات والتأثيرات الزمنية والاستقلال ومناسبة النموذج تتم قبل اعتماده. إذا استُخدمت أوزان زمنية: `r_e=exp(-ln(2)*age_e/half_life)`، فنصف العمر يُقدَّر من بيانات مستقلة ولا يُخترع افتراضيًا. عند ترابط الإجابات في الجلسة/عائلة السؤال، لا يُعامل عدد الأسئلة الخام كعدد عينات مستقلة: يمكن استخدام وزن لكل عنقود وحجم دليل فعال `n_eff = (Σω)^2/(Σω²)` بعد تعريف ω على مستوى العناقيد، مع اختبارات محاكاة للحالات الحدية.

### 4.3 عرض «الأضعف» بطريقة علمية

لكل مهارة: عدد المستهدفين الفريد، وعدد المقاسين المؤهلين، وعدد الضعف المثبت، وعدد غير المقاسين، والدليل المستقل، والفترة، والأداة/المصدر، والمادة والمسار. لا ترتيب بمتوسط خام وحسب. لا ترتيب عند حجم عينة غير كافٍ؛ يمكن تجربة Empirical Bayes أو Wilson lower/upper bounds **بعد تحديد معنى المؤشر** (مثل prevalence of confirmed need، لا نسبة صحيح الأسئلة عشوائيًا) والتحقق من صحة المقارنة وعدم العد المتكرر بين المواد.

### 4.4 جاهزية هدف وأداء زمني

قرار الجاهزية `Ready(G_v)` هو **بوابة شروط**: تغطية كافية + استيفاء مهارات حرجة + أدلة مستقلة صالحة + حداثة + إتقان وفق سياسة الهدف + أداء تحت الوقت إن كان نوع الهدف يتطلبه. عند عدم اكتمال أي محور مطلوب: **لا إعلان جاهزية**. القيم 80% ومحاكيين و21 يومًا إن وجدت في المرفقات أمثلة لا عتبات معتمدة. لا تعِد بدرجة رسمية أو «تطابق 100%» دون توثيق مواصفات واختبار مطابقة مستقل ومعايرة على النتائج الفعلية المصرّح بها.

### 4.5 النماذج المتقدمة

`Classical Test Theory` لتحليل صعوبة السؤال وتمييزه والبدائل؛ `IRT/Rasch/MIRT` لتقدير القدرة والصعوبة والخطأ المعياري عند توافر بنك مُعايَر؛ `BKT/PFA` لتتبع المعرفة؛ `Cognitive Diagnosis/Q-matrix` إذا أسئلة متعددة مكونات المعرفة تتطلبها؛ `Spaced Retrieval/Retention` للمراجعة؛ `Learning Analytics/Early Warning` مع فصل النشاط عن الدليل؛ `Intervention Analytics` لا تنسب التحسن سببيًا تلقائيًا؛ `CAT` فقط بعد تحقق بنك التكيف والإنصاف وحماية التعرض. اختبر مقارنة كل نموذج بالأساس الأبسط، والمعايرة وdrift والإنصاف على مجموعات وأزمنة مستقلة.

## 5. بحوث العمليات وذكاء القرار (OR) — مسائل منفصلة ذات هدف وقيود

**القاعدة:** Measurement decides what we know. Decision rules select educational need. OR chooses feasible allocation. AI explains within limits. كل مسألة لها `input_schema, objective, hard_constraints, soft_constraints, solver_version, cost_limit, timeout, feasible_verifier, fallback, audit_record`.

### 5.1 خطة الطالب — Multiple Knapsack/Resource-Constrained Scheduling

`x_{a,d}∈{0,1}`: هل نضع نشاطًا `a` في اليوم `d`؟  

`max Σ_{a,d} (v_{a,d} - λf fatigue_{a,d} - λc change_{a,d}) x_{a,d}`.

`Σ_a duration_a x_{a,d} ≤ available_minutes_d` لكل يوم. إضافة أيام الراحة، المتطلبات السابقة، توقيت اختبار الهدف، المحتوى المنشور والمستحق، عدم تغيير الأنشطة المنجزة، منع تعارض الأنشطة، عدم إرهاق طالب، جلسة إعادة قياس مستقلة بعد التدريب، توقع فشل/نقص البنك. `v` **قيمة قرار تجريبية** تستنتج من أهمية المهارة واحتياجها وقياسها، وليست زيادة مضمونة في درجة رسمية. إن لم تكف الدقائق: خطة جزئية مع مؤجلات وسبب واضح، لا إسقاط صامت لمهارة حرجة.

### 5.2 تكوين الاختبار — Integer Programming/ATA

`y_q∈{0,1}` سؤال/نسخة معتمدة في نموذج جديد.  
`Σ_q y_q = N`; لكل مادة/قسم/مهارة `lower_k ≤ Σ_{q∈k} y_q ≤ upper_k`; قيود الزمن والصعوبة إذا كانت مقدّرة تقديرًا صالحًا، عدم التكرار القريب، عائلة السؤال وقطعة القراءة all-or-none، exposure cap، عدم كشف سؤال تدريب في امتحان محمي وفق السياسة، الترتيب/التسهيلات. النموذج **مسودة للمراجعة**؛ إذا لا أسئلة كافية تُعرض فجوة البنك مع التفاصيل، ولا حل غير قابل للتحقق أو نشر تلقائي. لن نَعِد «مطابقة قياس 100%» دون وثيقة معايير رسمية وسلسلة إثبات.

### 5.3 تدخلات المدرسة — Assignment + Timetabling

`z_{u,g}` إسناد الطالب `u` لمجموعة `g`، `t_{g,r}` تخصيص معلم/موعد/قاعة. قيود صلبة: اختصاص المعلم ومادته، الفصل/المدرسة المصرح بها، السعة، عدم تضارب الطلاب والمعلمين/القاعة، أوقات الدراسة، مدة الجلسات، توفر محتوى داعم، عدم إرسال تكليف دون مراجعة/موافقة؛ قيود مرنة: تقليل الانتظار والتنقل وتوازن العبء وعدم وصم مجموعات الطلبة. المخرجات Draft قابل للتحرير واعتماد المسؤول. `CP-SAT` مفيد إذا أثبت baseline صعوبة التوزيع عند الحجم.

### 5.4 فجوات المحتوى والأسئلة — Prioritization

`h_k` ساعة تكلفة معالجة فجوة مهارة؛ `impact_k` عدد مستفيدين مؤهلين × أهمية فجوة × درجة عدم التغطية، بعد مراجعة الجودة والإنصاف. `max Σ impact_k x_k` مع `Σ h_k x_k ≤ author_capacity` وقيود أولوية سلامة الأسئلة ومراجعة الناشر. لا تجعل الطلب التجاري وحده يحدد أولوية الأطفال الأقل تمثيلًا.

### 5.5 أدوات ومتى تستخدم

- **Go deterministic baseline**: حسابات جاهزية وحلول خطط صغيرة قابلة للتفسير؛ ابدأ بها، واختبر زمنها وصحة قيودها.
- **OR-Tools CP-SAT** عبر عامل Python أو C++/Java/C# معزول إذا كانت المشكلة تستحق؛ **Go ليس لغة ربط رسمية أساسية في توثيق OR-Tools** فلا نضيف مكتبة Go غير موثوقة بحجة السرعة. العامل يستقبل معرّفات مستعارة ودقائق/قيود فقط، يرجع حلاً و`status`, `objective`, `elapsed`, `solver_version`; Go يراجع القيود مرة ثانية قبل الحفظ والعرض.
- **MIP/MILP** للتجميع أو التخصيص عندما يلائم؛ `min-cost-flow` أو assignment للخدمات البسيطة؛ constraint programming عند جدولة متشابكة؛ قواعد حتمية عند الأحجام الصغيرة. لا تجعل OR مطلوبًا لفتح صفحة أو حفظ إجابة.
- **Fallback:** status `FEASIBLE/OPTIMAL/INFEASIBLE/UNKNOWN/TIMEOUT` بحسب محرك الحل، وبديل حتمي يتبع كل قيد، أو شرح تعذر دون ادعاء نجاح.

## 6. خريطة تجربة المستخدم — أين يظهر ذكاء المنصة؟

**قاعدة التصميم:** لا قائمة جديدة طويلة؛ في كل صفحة «الحالة + السبب + إجراء رئيسي واحد»، ثم تفاصيل Drill-down، وربط سياق `pathId/subjectId/goalId/skillId` في التنقل. لكل واجهة Loading/Empty/Forbidden/Offline/Error/Stale/No Entitlement، وتغيير المسار يزيل بيانات السابق فورًا. مصدر Legacy يُطابق بصرية وفعليًا عند 390/820/1440 RTL.

### 6.1 الطالب — `/dashboard`, `/learning`, `/plan`, `/reports`, `/assessment-results`, `/review`

| مكان الظهور | ما يظهر | الأزرار / سلوكها |
|---|---|---|
| نظرة عامة | هدف نشط، حالة جاهزية مفسرة، آخر قياس، تنبيه عدم اكتمال، خطوة اليوم | «ابدأ خطوة اليوم» إلى المورد/الاختبار الحقيقي؛ «لماذا؟» أسباب القرار؛ «اختر المسار» |
| مساراتي | مسارات عديدة منفصلة: تقدم كل مادة والمهارات المطلوبة | «افتح المادة»؛ «خريطة المهارات»؛ «حدد هدفًا» |
| المسار الذكي | شجرة رئيسي/فرعي، تغطية وإتقان وثقة وحالات غير مقاس/بحاجة علاج | «ابدأ تشخيصًا»، «افتح التأسيس»، «تدرب»، «راجع الأخطاء»، «أعد القياس»، «أضف للخطة» حسب أهلية المورد |
| خططي | أيام/دقائق/أيام راحة وأنشطة متسلسلة؛ المؤجل واضح؛ التنفيذ لا يعني إتقانًا | «معاينة»، «اعتمد»، «أنجزت»، «غير وقتي»، «أعد جدولة»، «لماذا هذا النشاط؟» |
| تقاريري | لكل مسار/مادة/مهارة نتائج حديثة وتراكمية وتغير بعد التقييم مع مصدر وحجم الدليل | «اعرض أدلة القياس»، «مهارة معينة»، «مقارنة»، «الدرس»، «إعادة قياس» |
| نتائج الاختبار | تفصيل المحاولة، ماذا قيس، ماذا لم يُقس، انتقال لخطوة مفيدة | «راجع خطئي»، «افتح الدرس»، «تدرب»، «إعادة قياس» دون كسر نتيجة الاختبار |
| مراجعاتي/تأسيس/إشعارات | بطاقة واحدة للسؤال المحفوظ والخاطئ، مراجعة spaced، رابط الدرس | «تدرب على هذه الأسئلة»، «تثبيت المراجعة»، «تأجيل التذكير» |

**نصوص واجهة سلوكية صحيحة:** «لم نقس مهارتين من المطلوب بعد؛ ابدأ اختبارًا تشخيصيًا»؛ «تحسنت في الكسور في قياس مستقل جديد»؛ «إجاباتك في التدريب بمساعدة لا تكفي للحكم على الجاهزية»؛ «الخطة المقترحة تحتاج 50 دقيقة يوميًا، والمتاح 30؛ عرضنا الممكن وأجلنا الباقي»؛ «مستعد وفق معايير المئة لهذا الهدف» **ليس «تضمن درجة كذا»**.

### 6.2 ولي الأمر — `/parent-dashboard`

يختار ابنًا مرتبطًا فعليًا + مسارًا + مادة. يرى ماذا قيس، المهارة ذات الحاجة المثبتة، السبب بلغة رحيمة، نشاط الأسبوع، الإنجاز، موعد اختبار أو إعادة قياس، هل تحسن أم نحتاج أدلة. أزرار «الابن»، «مهارات تحتاج متابعة»، «خطة الأسبوع»، «آخر اختبار»، «تقرير الأسبوع»، «تذكير» عبر قناة مرخصة. **لا تعديل لإتقان أو درجات أو تكليف مدرسة، ولا عرض طالب بعد إلغاء الربط.** لا ترسل رسائل تثير القلق بعبارة «ابنك فاشل»؛ استخدم صياغات دقيقة وغير وصمية.

### 6.3 المعلم — `/school-teacher-dashboard`

تحت «أدلة التعلم/مهارات الحصص/اختباراتي وتكليفاتي» — يختار مدرسة وفصلًا ومادة مكلفًا بها، فترة ومصدر قياس؛ تعرض الرئيسية والفرعية: عدد المستهدفين، المقاسين، غير المقاسين، ضعف مثبت، إتقان ببيانات مؤهلة، خطة تدخل. أزرار «تحليل مهارات فصلي»، «الطلاب المحتاجون»، «ابدأ تشخيصًا»، «معاينة التدريب»، «إسناد بعد الموافقة»، «اقتراح مجموعة دعم»، «قارن قبل/بعد». منع اكتشاف طالب خارج `school+class+subject`.

### 6.4 المشرف — `/supervisor-dashboard` و `/supervisor-dashboard/interventions`

ملخص الطلاب والفصول والمدارس ضمن تفويضه، ومقارنة مصادر دليل المدرسة/الحصة/المنصة دون دمج درجات مصطنعة. عرض قائمة احتياج مثبت وقائمة نقص قياس مستقلتين. أزرار «خريطة المهارات»، «الفصول المحتاجة»، «غير المقاسين»، «ملف الطالب»، «مسودة تدخل»، «مراجعة قياس لاحق»، «اعتماد إغلاق» فقط إن كانت الصلاحية تسمح. لا يملك نشر مقرر عام أو تعديل سياسة المنصة.

### 6.5 مدير المدرسة — `/school-director-dashboard` و `/school-director-dashboard/interventions`

مؤشرات المستهدفين الفريدين، المقاسين، غير المقاسين، الجاهزين وفق هدف محدد، المساعدات المفتوحة والمنفذة والمتأخرة؛ Heatmap المسار/المادة/الفصل/المهارة، سعة المعلمين، خطة تقوية مسودة، المقارنة المنصفة للفصول. أزرار «تحليل المدرسة»، «فصول تحتاج قياسًا»، «فصول تحتاج دعمًا»، «خريطة المهارات»، «جدول التقوية المقترح»، «تعديل/اعتماد تدخل»، «عرض أثر التدخل»، «تقرير المدرسة». لا مقارنة خادعة لمدارس بأهداف/أعداد مقاس مختلفة.

### 6.6 المدرب ومنشئ السؤال ومراجع الجودة

خريطة المهارات التي تفتقر إلى درس/تدريب/أسئلة جيدة، وفق نطاق المحتوى فقط: «أضف سؤالًا»، «اربط بالمهارة»، «تحقق من نسخة المفتاح»، «صمم موضوعًا»، «جهز تدريبًا»، «قدم للاعتماد»، «قارن مخطط الاختبار بالبنك». لا وصول تلقائي إلى ملفات طلاب ولا نشر آلي بواسطة AI/solver.

### 6.7 مالك المنصة — `/admin-dashboard/reports` قسم «ذكاء التعلم والجاهزية»

ست تبويبات داخل التقارير الحالية لا لوحة شاملة ثانية:

1. **الصورة العامة:** طلاب فريدون B2C/B2B، المقاسون، غير المقاسين، توزيع قرارات الجاهزية حسب الهدف، القرارات المتأخرة، مع إظهار النطاق والفترة والمقام.
2. **المسارات والمواد والمهارات:** drill down منصة→مسار→مادة→رئيسية→فرعية؛ «أضعف المهارات ذات أدلة كافية» و«أكثر المهارات غير المقاسة» قائمتان مختلفتان؛ الفئة والمدرسة/الفصل/التقييم والفترة.
3. **جودة بنك الأسئلة والمحتوى:** أسئلة بلا مهارة، خريطة غير منشورة، بنك ضعيف أو معرَّض بكثرة، مهارة بلا تأسيس أو تدريب؛ روابط عمل إلى المراكز الموجودة.
4. **الخطط والتدخلات:** قبول الخطة وتنفيذها والقياس اللاحق، التدخل المفتوح/المنجز/المعتمد، تعذر solver، وتكلفة كل قرار.
5. **المدارس والنتائج:** توزيع الحالات والتغطية والضعف المثبت ضمن حجم عينة كاف؛ لا تشهير ولا ranking تمييزي بسبب نقص تغطية.
6. **السياسات والحوكمة:** إصدارات مخططات الأهداف، محاكاة سياسة جديدة على بيانات تاريخية دون تغيير الدرجات، مراجعة واعتماد، Feature flags، مراقبة latency ومعدل خطأ القرار وحماية الخصوصية.

أزرار واضحة: «تصفية المسار/المادة/المهارة»، «أكثر الاحتياجات المثبتة»، «ناقص القياس»، «أسئلة المهارة»، «محتوى التأسيس»، «مهمة بنك/محتوى»، «محاكاة السياسة»، «طلب اعتماد»، «سجل التدقيق»، «تصدير مجمع». كل Export يطبق نفس Scoped Auth والحد الأدنى لحجم المجموعة ومنع الاستدلال عبر تقاطع الفلاتر.

**مثال:** المدير يفتح «الكسور» في مسار محدد؛ يرى 1000 مستهدف، 740 لهم قياس مؤهل، 210 ضعف مثبت، 260 غير مقاس، سؤال يحتاج مراجعة، درس تأسيس منشور؛ ثم ينتقل إلى «افتح الأسئلة» أو «أنشئ مهمة محتوى». الأرقام هنا توضيحية فقط.

## 7. التكامل البرمجي — مصدر قرار واحد

`AttemptFinalized -> EvidenceApplied(idempotent) -> SkillProgressChanged -> AffectedGoalReadinessRecomputed -> NextActionAvailable -> PlanRefreshProposal -> InterventionFollowup`.

تثبت ملكية التصحيح في `assessment` وملكية الإتقان/الجاهزية في `learning` وملكية الطالب/الفصل في `organizations` وملكية التقرير في `reporting`. التحديث يمكن أن يكون event/outbox موثوقًا، لا يلزم Kafka أو Microservice. معاملة Go/Postgres تسجل النتيجة/الحدث ذريًا أو باستراتيجية مطبقة مثبتة؛ Worker يعالج `at least once` مع Idempotency، وCAS/`data_revision` يمنع رسالة متأخرة من قهر قرار أحدث. فشل مؤقت يعرض `stale`/«تعذر تحديث التحليل» ولا يصدر نجاحًا وهميًا.

**نموذج بيانات إضافي مقترح فقط بعد الجرد:**

- `learning_goals`, `learning_goal_versions`, `learning_goal_skill_targets`, `learning_policy_versions` **إذا كانت غير موجودة**.
- `skill_prerequisite_edges` مع cycle check وفحص الصلاحية والنشر.
- `learning_readiness_current` مع unique حسب الطالب/الهدف/إصدار goal/policy ومع `data_revision`؛ `UPSERT` يحفظ current.
- `learning_readiness_history` مختصر للأحداث المعنوية (تغير الحالة/الإصدار/سبب مهم) وبسياسة احتفاظ معتمدة، لا Snapshot لكل قراءة.
- `learning_decision_actions` أو توسيع next-action القائم؛ لا نسخ نص السؤال أو صورة المصدر.
- روابط أصلية لتدخل المدرسة/خطة الطالب/قيمة baseline/post-measurement.
- read models مجمعة لمؤشرات المدرسة والمنصة بالـscope/time/source؛ تجنب materialization لكل تركيبة filters.

**APIs مقترحة للتحقق من أسماء الموجود أولًا:** `GET goals`, `GET readiness(goal)`, `GET skill-map`, `GET next-action`, `POST plan/preview`, `POST plan/accept`, `POST plan/reschedule`, `GET scoped-school-learning`, `POST intervention/draft`, `GET admin intelligence overview/skills/gaps`, `POST policy/simulate`. OpenAPI/DTO/Go contract موحد؛ 400/401/403/404/409/503 وCSRF/idempotency/write audit. لا تفتح endpoint كاشفًا لمجرد أن React يخفي الزر.

## 8. الأداء ومنع التضخم ونضج التشغيل

- **لا تكرار:** سؤال/نسخة/صورة واحدة، ReviewCard واحد لأسباب مختلفة، Evidence keyed، قرار Current واحد، History sparse، لا صور في PostgreSQL analytics.
- **Incremental compute:** إعادة الحساب للطالب والمهارات والأهداف المتأثرة، ثم projection محدود للمدرسة/المنصة. احذر backfill المكلف بدون throttling ومراقبة.
- **PostgreSQL:** قيد uniqueness/foreign keys/checks، فهارس على استعلامات واقعية بعد `EXPLAIN (ANALYZE, BUFFERS)`, partitioning فقط بعد إثبات الحجم، batch وpagination وavoid N+1.
- **Redis:** cache غير سلطوي بمفاتيح tenant/role/scope/goal/policy/dataRevision، TTL وinvalidation. لا تضع نتيجة حساسة مشتركة بمفتاح ناقص.
- **Workers:** limits CPU/RAM/time/queue/depth/retry/backoff/dead-letter/reconciliation، feature flag، circuit breaker، وقاعدة لا solver ولا AI في مسار تصحيح السؤال التزامني.
- **AI:** مساعدة باختيار المستخدم وبسياق السؤال/المهارة المصرح، guardrails وtoken budget وtimeout/fallback، ولا يسترجع إجابات محمية قبل التسليم.
- **وسائط وOCR:** الصور/الفيديو في R2 وفق العقود؛ OCR اختياري **لإدخال محتوى مملوك/مرخّص** وتحويله إلى مسودات أسئلة/نصوص تخضع لمراجعة بشرية للمفاتيح والرسوم والمهارات؛ OCR لا يقيس جاهزية الطالب ولا يمنح ملكية نشر. لا تجمع OCR وOR في مفهوم واحد.
- **القابلية للتوسع:** load test بأحجام B2C/B2B اصطناعية، budgets للزمن/التكلفة تُحدد بعد baseline؛ لا أرقام خيالية مثل أقل من 10ms لكل مسألة.
- **المقاييس:** `readiness_update_lag`, `decision_stale_rate`, `evidence_duplicate_rejected`, `query_p95`, `optimizer_runtime_ms`, `optimizer_feasible_rate`, `plan_infeasible_rate`, `queue_depth`, `cache_hit_rate`, `cost_per_plan`, `ai_cost_per_1k_users`, `recheck_completion_rate`, `learning_gain_with_uncertainty`.

## 9. الأمان والخصوصية والإنصاف

- Student: نفسه؛ Parent: علاقة نشطة، revoke تزامني؛ Teacher: تكليف مدرسة+فصل+مادة نشط؛ Supervisor: تفويض مدارس/فصول/مصادر؛ School Director: مدرسة مخولة ووحدات عقد؛ Trainer: المحتوى المكلف؛ Admin: تجميعات عامة أولًا وتفويض محدد لبيانات الأفراد.
- Privacy-by-design حسب PDPL وإرشادات سدايا؛ الحد الأدنى للبيانات والموافقات وقواعد نقلها والاحتفاظ بها؛ راجع متطلبات القُصّر وولي الأمر قبل بيانات النتائج الخارجية أو مشاركة مزود AI.
- Small-cell suppression بقواعد واضحة ومراجعة خطر إعادة التعرف عبر تقاطع الفلاتر وDifferencing/exports؛ عدد 5 أو 10 مجرد مرشح سياسة ولا يعتمد بلا تقييم مخاطر.
- Fairness عبر الأجهزة، نوع المدرسة، ظروف الاتصال، أنماط القياس والتسهيلات المعتمدة؛ لا نعاقب الطالب على نقص البنك أو الإعاقة أو انقطاع النت أو عدم شراء المحتوى.
- لا AI ينشئ «نجاح/رسوب» رسميًا؛ لا «احتمال نجاح» غير معاير؛ explainability ومراجعة بشرية للقرارات عالية الأثر.

## 10. وكالة التنفيذ: عدد قليل من الوكلاء، أدوار واضحة

**لا سرب دائم.** نموذج فعال واقتصادي:

| الدور/الوكيل | وظيفته | أدواته/سكيلز المشروع | يكتب؟ |
|---|---|---|---|
| Orchestrator (أنا/منفذ الجلسة) | يقرأ الخطة وأحدث GitHub وCheckpoint، يختار شريحة، يقسم العمل والملفات، يتابع الأدلة، يقرر جاهزية PR | GitHub, plan03, AGENTS, Action Ledger | لا يُكرر كتابة منفذ آخر |
| Legacy Contract & UX | استخراج الشاشة/السلوك الصحيح ولقطات المقارنة والنطاق | `almeaa-parity-checker`, `almeaa-rtl-browser-verifier`, Playwright | متى امتلك ملف UI فقط |
| Pedagogy/Psychometrics reviewer | سياسة الأهداف والأدلة وعدم اليقين والإنصاف وتوافق المحاور | عينة Golden Cases، قواعد القياس، مصادر NCME/ETS | غالبًا مراجعة غير كتابية |
| Go Domain implementation | نواة التغطية/الجاهزية والتوصية والقيود القابلة للتفسير | Go test, `almeaa-learning-workflow-validator`, `almeaa-api-contract-validator` | الكاتب الوحيد للشريحة |
| Database & Taxonomy | الجداول الإضافية والفهارس وmigrations/rollback | `almeaa-db-migrator`, `almeaa-content-taxonomy-guard`, SQL tools | نفس الكاتب أو ملكية ملفات منفصلة |
| Assessment/OR specialist | صياغة optimizer وATA، التحقق من القيود والـfallback | Go baseline, OR-Tools/CP-SAT عند الحاجة, benchmark | لاحقًا ونطاق محدد |
| School/Access reviewer | معلم/مشرف/مدير/ولي أمر، checks وnegative tests | `almeaa-rbac-audit`, `almeaa-school-director-validator` | مراجعة مستقلة |
| CI/Independent reviewer | فحص diff وCI وE2E والأداء وexplainability، بلا إخفاء فشل | `almeaa-ci-health-monitor`, `almeaa-pr-controller`, Playwright | مراجعة فقط |

**Antigravity:** يواصل Migration/Legacy parity بملكية ملفات محددة. **Codex/ChatGPT:** ينفذ Learning Intelligence داخل Go بفرع/Worktree مستقل. **Gemini/DeepSeek/مراجع آخر:** قراءة/تحقق مستقل حسب الحاجة، وليس ثلاثة كتاب على ملف واحد. إذا انخفضت الحصة/Quota: كاتب واحد + مراجع عند التسليم؛ لا تشغيل خمسة Subagents متكررين. وجود وكيـل متخصص مشروط بإمكان تشغيله فعليًا لا بوعد نظري.

**سكيلز ALMEAA المستهدفة** (من قائمة بروتوكول المستودع، افتح ملفات `SKILL.md` الفعلية أولًا): `almeaa-parity-checker`, `almeaa-rtl-browser-verifier`, `almeaa-api-contract-validator`, `almeaa-db-migrator`, `almeaa-content-taxonomy-guard`, `almeaa-learning-workflow-validator`, `almeaa-school-director-validator`, `almeaa-rbac-audit`, `almeaa-commerce-tap-guard`, `almeaa-ci-health-monitor`, `almeaa-pr-controller`, `almeaa-release-orchestrator`, `almeaa-ai-tutor-guard`, `almeaa-arabic-normalizer`. لا تُثبت إضافة مجهولة أو تغير الأسرار دون مراجعة وموافقة لازمة. أدوات التنفيذ الأساسية: Go, PostgreSQL test DB, sqlc إن مستخدم, Git/GitHub/CI, TS/Vite, Playwright screenshots/traces, ESLint, govulncheck, npm audit, EXPLAIN ANALYZE, k6/Lighthouse عند الحاجة.

## 11. المحاور الهندسية A–H: بوابات عملية

| المحور | ما يلزم في كل شريحة متأثرة |
|---|---|
| A أداء | index, N+1, pagination, image/lazy, Redis, skeleton, explain plan, benchmark |
| B أمان | RBAC relationship, rate limit, input, CSRF/XSS, session, secrets, fail-closed |
| C تشغيل | structured logs, trace, metrics, health, graceful shutdown, backup/restore |
| D UX | parity, RTL, a11y keyboard, offline/error/empty/stale, bundle, print/export |
| E تربوي | taxonomy integrity, evidence, mastery, diagnostic, feedback, adaptive, study plan, content QA |
| F امتثال | PDPL, consent, i18n RTL, WCAG, full audit, retention, small group protection |
| G بنية | single owner, explicit boundary, OpenAPI ↔ React ↔ Go, no duplicate source truth |
| H إثبات | TDD RED/GREEN, Go+PG+HTTP, real E2E, screenshots, four gates, exact SHA, evidence ledger |

## 12. التنفيذ المرحلي — شرائح عمودية ببوابات واضحة

**المرجع التنفيذي الوحيد** خطة Go القائمة. الخطوات أدناه تعد Task Tree تابعة؛ لا تتجاوز بوابة هجرة حالية أو تتداخل كتابة مع Antigravity.

| الشريحة | التسليم الفعلي | شرط القبول | تبعية/مالك |
|---|---|---|---|
| G0 Recovery & Contract | latest HEAD/PR/Checkpoint/worktrees، جرد Legacy ↔ Go، تثبيت contract goal/taxonomy/evidence، mocks audit | لا تعديلات على عمل وكلاء آخرين؛ فجوات مثبتة وسيناريوهات RED | orchestrator + reviewer |
| G1 Foundation | Goal/Policy versions إذا ناقصة، full denominator coverage و`EvaluateGoalReadiness` نقية وshadow، Current/History بعمر محسوب، idempotency | 10 Golden Cases Go+PG، لا تغيير score قديم ولا تكرار دليل | Go/domain/data |
| G2 Student Loop | بطاقة واحدة + smart-path + reports + result + plan + review links كلها تقرأ نفس readiness | اختبار→دليل→قرار→تأسيس/تدريب→recheck→تقرير مع persistence وRTL | React + Go |
| G3 Family & School | Parent/Teacher/Supervisor/Director scoped projections + تدخل Draft/Approve/Execute/Recheck/Review | negative RBAC وغياب دليل ومقامات، لا عبر مدرسة، لا data leak | school/security |
| G4 Owner Intelligence | admin reports intelligence six tabs، skill rankings/gaps/quality/policies | تدقيق عدد مستهدفين/مقاسين/غير مقاسين وفصل مصادر ومجموعات صغيرة | reporting |
| G5 Operations Research | Go baseline plan ثم ATA، تحسين جداول المدرسة/فجوات المحتوى؛ CP-SAT عند مقارنة حقيقية | hard constraint verifier، timeout fallback، review before apply، benchmark | optimization |
| G6 Advanced Measurement | CTT ثم IRT/BKT/retention/CAT والتنبؤ المعاير على عينات مستقلة | calibration/equity/backtest approval، لا احتمال غير مثبت | pedagogy/data science |
| G7 Certification | مراجعة مستمرة لكل الشاشات/النطاقات/الأداء/المحاور؛ مرحلة نشر منفصلة بتفويض | traces وCI/PR exact-head وE2E لا مجرد Mock؛ rollback | reviewer/orchestrator |

**شريحة أولى قابلة للإغلاق:** هدف تجريبي حقيقي من بيانات معزولة داخل مسار منشور، 10 مهارات مطلوبة بينها 7 بلا دليل؛ الطالب يظهر «نحتاج قياسًا» بدل جاهز، ثم يسلم تشخيصًا، فتتحدث نفس الحالة في المسار الذكي ونتيجة الاختبار وتقاريري وخططي، مع تحقق إتقان ودليل واحد، ومعلم يرى الملخص في فصل مصرح به **إذا كان الربط المدرسي ضمن نطاق الشريحة واختباراته مكتملة**. لا تدخل شريحة 7 شاشات دفعة واحدة؛ سلّم G1 domain مستقلًا ثم G2 رأسيًا قابلًا للاختبار.

## 13. حالات قبول ذهبية إضافية لا تقبل التفاوض

1. إنشاء مسار/مادة/مهارة جديد من الإدارة؛ لن يستدعي تغيير `switch QUDRAT` في Go.
2. هدف 10 مهارات والطالب قيس في 3 → المقام 10 (مع مراعاة الأوزان وleaf semantics).
3. طالب بلا دليل → «نحتاج قياسًا»، لا ضعيف؛ نقص بنك الأسئلة → «فجوة قياس/محتوى» لا لوم الطالب.
4. سؤال فرعي لا يحسب مرة للفرعي ومرة للأب كدليلين مستقلين.
5. سؤال متعدد الروابط لا يرفع إتقان كل مهارة دون Attribution معتمدة.
6. تكرار Submit/Outbox/Worker لا يضاعف دليلًا أو يبدل قرارًا أحدث.
7. تعديل تصنيف سؤال أو إصدار هدف لا يمس النتيجة التاريخية؛ محاكاة السياسة تحدث مقارنة فقط.
8. نشاط بمساعدة لا يرفع ثقة القياس المستقل.
9. عدم وجود محتوى منشور/مستحق يمنع فتحه، ويظهر بديل/سبب مفهوم.
10. طالب في مسارين؛ لا تبادل درجات بينهما.
11. ولي أمر أُبطل ربطه يُمنع من API/التصدير والكاش؛ معلم خارج تكليف/مدير مدرسة ثانية يُمنع.
12. مقارنة مدرسية لا تدمج محاولات طالب واحد كطلاب متعددين؛ المقام والمصدر واضحان.
13. تجميع صغير جدًا لا يكشف هوية طالب من الصادرات والتقاطعات.
14. اختبار صعب وسؤال وقت إجابته غير موثوق؛ لا يجزم المحرك أن الطالب ضعيف دون إعادة تحقق.
15. برنامج معالجة جديد لا يبدل معيار صعوبة السؤال القديم بصمت.
16. Solver infeasible/timeout يرجع status وشرح/بديل ولا يعتمد قيدًا مخالفًا.
17. هدف مع وقت قليل: خطة ممكنة جزئيًا مع مؤجلات معلنة، لا وعد غير واقعي.
18. ملخص ولي الأمر والمعلم والمدير والطالب من data revision نفسه، كل حسب النطاق.
19. تبديل مسار أثناء تحميل البيانات يمسح تفاصيل القديم ويتجنب race.
20. شاشة رئيسي/فرعي/فلاتر/سهم رجوع/لوحة RTL 390/820/1440 مع Error/Empty/Offline/Stale.
21. اختبار قبل/بعد لا يوصف causal effect من دون تصميم صالح.
22. نموذج احتمالي لا يستخدم كحكم جاهزية رسمي قبل توثيق معايرته على عينة مستقبلية مستقلة.
23. فشل مزود AI لا يمنع قياس المهارات أو عرض نتيجة مصححة مسبقًا.
24. Handoff دقيق: source/main SHA وtarget SHA، evidence، PR، blockers، next first command.

## 14. مؤشرات نجاح التجربة والقياس العلمي للجدوى

**الطالب:** نسبة الذين فهموا الخطوة التالية (اختبار استخدام)، نسبة إتمام النشاط ثم إعادة القياس، تحسن مستقل موثوق مع uncertainty، انخفاض false-ready/false-not-ready، زمن العثور على التأسيس.  
**المعلم:** دقائق تحديد الأولويات، نسبة التدخلات المراجعة والمنفذة، تحويل طالب محتاج إلى نشاط مناسب، زمن الإسناد، عودة القياس.  
**المدرسة:** تغطية القياس، عدالة المقارنة بين الفصول، حمل المعلمين/السعة، نسبة التدخلات المغلقة بدليل.  
**المنصة:** بنك أسئلة صالح/مرتبط، فجوات الدروس، `n_eff`, تأخر تحديث الجاهزية، كلفة/زمن optimization، فحوص خصوصية، نسبة السياسات التي اجتازت backtest.  

**قياس أثر حقيقي:** تحليل before/after وصفٌ فقط؛ استخدم cohorts أو staggered rollout/stepped-wedge أو RCT بمراجعة أخلاقية/خصوصية وحجم عينة، وانتبه إلى Regression to the Mean والتباين المدرسي وعدم تساوي فرص الاستخدام. لا تُعلن ميزة «تحسين الدرجات بنسبة كذا» قبل نتائج المئة نفسها.

## 15. بروتوكول تشغيل الوكلاء والتوقف والاستئناف

### 15.1 أول دقيقتين في كل جلسة (أمر للمشغّل، لا مدة زمنية مضمونة)

1. `pwd; git status --short; git branch --show-current; git rev-parse HEAD` ثم `git fetch origin --prune` بحذر على worktree محفوظ و`git rev-parse origin/main`.
2. اقرأ `AGENTS.md`, `03_EXECUTION...`, آخر dated entry في `CHECKPOINT_AR.md`, `OWNER_BATCH_DELIVERY_CONTRACT_AR.md`, `ANTIGRAVITY_EXECUTION_STANDARD_AR.md`, `ALMEAA_ENGINEERING_PILLARS_MASTER.md`, السياسة التربوية، ADR-0008، ووثائق الشريحة.
3. افحص `gh pr list`, `gh run list`, Branch/Worktree/file ownership؛ لا تستنتج حيوية Antigravity من رسالة قديمة.
4. اقرأ أحدث مصدر `almeaacodax/main` للرحلة المقصودة فقط، واستخرج contract ومصفوفة عزل.
5. اختر أصغر **vertical slice** لا تصطدم بممتلكات كتاب آخرين. سجل baseline tests وGolden Cases وملفات الملكية.
6. نفّذ RED → minimum safe change → GREEN → integrated HTTP/PG → UI browser/negative → docs/PR → exact SHA CI/review.

### 15.2 نموذج Report لكل دفعة

`Slice ID | Owner agent | branch/worktree | source SHA | target SHA | PR | contract/expected | files owned | changed files | RED/green evidence | real Go/PG? | Playwright 390/820/1440? | security negatives | data perf baseline/after | exact-head CI four gates | review | state VERIFIED/PARTIAL/BLOCKED | next exact command | blockers/safe fallback`.

### 15.3 عندما يقول المالك «أنا هنام، كمل»

هذه الوثيقة وحدها لا تمنح الوكلاء تشغيلًا ذاتيًا دائمًا. **ChatGPT داخل محادثة عادية لا يواصل كتابة الكود بعد انتهاء الجلسة تلقائيًا**؛ لا يعد بتسليم مستقبلي. إذا كانت جلسة Antigravity/بيئة عمل مستقلة تعمل بجدولة وتفويض وصلاحيات كافية، تستطيع متابعة دفعاتها ضمن الحد المسموح بعد ضبط توقفات آمنة؛ لا يجوز افتراض أنها تعمل فعلًا، ويجب مراجعة logs/CI وcheckpoint. عند انقطاع quota/browser/connection، احفظ commit/stash غير مدمر وreport/branch/first command وBLOCKED. للعودة لا تعيد discovery من الصفر ولا تطلب توضيحات محسومة؛ استأنف آخر slice ذات evidence، وأعد فحص SHA وملكية الملفات.

**قواعد الدمج:** 4 Gates `Database`, `Backend`, `Frontend`, `Frontend E2E`، ومراجعة Security/Role/Parity وExact final SHA، ثم قرار الدمج. دمج PR لا يعني نشره للإنتاج. لا تغييرات أسرار أو فواتير أو بيانات إنتاج أو Legacy أو force push دون تفويض مستقل.

## 16. ما لن نفعله

- لا نسمي الـOCR بحوث عمليات؛ OCR مسار إدخال محتوى اختياري، وOR قرارات وتحسين.
- لا ML ضخم، deep learning, vector DB, data lake, Kafka, microservices, أو مراقب دائم قبل وجود حاجة/قياس واضح.
- لا نسبة جاهزية أو احتمال درجة رسمية من بيانات قليلة، ولا مصادرة للقرار التربوي عن المعلم.
- لا روابط وهمية في مسارات الذكاء ولا fallback لبيانات أمثلة يعرض كقرار حقيقي.
- لا نسخ/حذف نتائج أو مواد مدفوعة أو مفاتيح إجابات بقرار AI/solver.
- لا توحيد درجات مسارات مختلفة في مؤشر Portfolio مضلل.
- لا جدول تاريخي لكل قراءة أو تقرير materialized لكل فلتر؛ لا احتفاظ غير محدود.
- لا تشغيل خمسة مراجعين متوازيين لحالات quota سابقة؛ كاتب واحد + مراجع مستقل حسب الحاجة.
- لا وعود بتطابق رسمي أو latency افتراضي؛ كل ادعاء ميزة يُثبت باختبار قابل للتكرار.

## 17. مواد الاستدلال والبحث (مراجعة رسمية بتاريخ 25-11-2026)

**مصادر المستودع:**
- https://github.com/nasef6464/almeaago/blob/main/AGENTS.md
- https://github.com/nasef6464/almeaago/blob/main/docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md
- https://github.com/nasef6464/almeaago/blob/main/docs/ALMEAA_ENGINEERING_PILLARS_MASTER.md
- https://github.com/nasef6464/almeaago/blob/main/docs/engineering/ANTIGRAVITY_EXECUTION_STANDARD_AR.md
- https://github.com/nasef6464/almeaago/blob/main/docs/architecture/ADR-0008-OPERATIONS-RESEARCH-OPTIMIZATION.md
- https://github.com/nasef6464/almeaacodax/blob/main/docs/product/STUDENT_JOURNEY_PHILOSOPHY_AR.md

**المراجع الخارجية (وظائف موثقة لا ادعاء استخدام كل الشركات لـOR):**
- ALEKS Knowledge Space Theory: https://www.aleks.com/about_aleks/knowledge_space_theory
- Khan Academy Mastery Challenges: https://support.khanacademy.org/hc/en-us/articles/360037494231-What-are-Mastery-Challenges
- IXL diagnostic and action plan: https://blog.ixl.com/2021/01/28/common-questions-about-the-ixl-real-time-diagnostic/
- i-Ready 2026 updates: https://www.curriculumassociates.com/about/press-releases/2026/9/i-ready-2026-2027-updates
- NWEA precision / SEM: https://www.nwea.org/blog/2025/measuring-growth-and-understanding-negative-growth/
- ETS Automated Test Assembly with MILP: https://www.ets.org/research/policy_research_reports/publications/article/2020/kaet.html
- ASSISTments / IES research: https://ies.ed.gov/use-work/awards/evaluating-effectiveness-assistments-improving-math-achievement
- Google OR-Tools/CP-SAT: https://developers.google.com/optimization/cp/cp_solver
- Google OR-Tools installation/languages: https://developers.google.com/optimization/install
- Makkook DIOS: https://makkook.ai/dios
- 1EdTech Caliper Analytics interoperability: https://www.1edtech.org/standards/caliper
- NCME Standards for Educational and Psychological Testing: https://ncme.org/resources/books/testing-standards/
- SDAIA PDPL/data minimization: https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/
- UNESCO public digital learning platforms charter: https://www.unesco.org/en/articles/unesco-unicef-and-itu-launch-charter-public-digital-learning-platforms

**المرفقات التي وُحّدت أفكارها دون استنساخ:** `ALMEAA_UNIFIED_LEARNING_INTELLIGENCE_BLUEPRINT_AR.md`، `المخطط الشامل لمحرك ذكاء التعلم وبحوث العمليات في منصة المئة (نسخة تسليم ChatGPT).pdf` (خاصة ص 3–8)، `نص ملصق (2).txt`، وتاريخ المحادثة `نص ملصق.txt`. الوارد فيها Proposal إلا ما يثبته المصدر الجاري. لا يُسقط التفصيل الخاص بالمدارس أو الطالب من الوثائق الأقدم بلا مقارنة مقصودة.