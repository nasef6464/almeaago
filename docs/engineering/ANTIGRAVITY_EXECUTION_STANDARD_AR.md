# ALMEAA Go — بروتوكول التنفيذ الدائم متعدد الوكلاء

**الحالة:** سياسة تنفيذ مدمجة في #281. تُقرأ أولويات الدفعات من خطة التنفيذ ونقطة الاستئناف الحالية.
**النطاق:** `nasef6464/almeaago`، كل وكلاء التنفيذ والمراجعة في Antigravity / Codex / DeepSeek Harness.  
**مصدر السلوك/الشكل:** أحدث `nasef6464/almeaacodax/main` للقراءة فقط.  
**الخطة الوحيدة:** `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md`.  
**عقود أخرى واجبة القراءة حسب المهمة:** `AGENTS.md`, `docs/migration/OWNER_BATCH_DELIVERY_CONTRACT_AR.md`, وثائق سياسة المنصة والتأسيس والاختبارات، `docs/migration/owner-handoff/2026-11-01/CHECKPOINT_AR.md`. وثيقة `docs/ALMEAA_ENGINEERING_PILLARS_MASTER.md` وADR-0008 ظهرتا في PR #280 عند إعداد هذه الحزمة، وليستا مفترضتين موجودتين في `main` حتى الدمج.

## 1. القاعدة العليا

منع الفجوة «تمت البرمجة محليًا» ↔ «الوظيفة تعمل فعلًا». لا يعني PASS في Mock أو Typecheck أو Build اكتمال وظيفة. الإغلاق هو سلسلة أدلة: **Legacy contract → UI → exact HTTP payload → Go decoder/auth/application → PostgreSQL/Redis/R2 وفق الحاجة → persisted observable effect → negative scenarios → screenshots → exact-head CI → approved merge → deployment verification عند تفويض النشر**.

أمثلة لحالات لا تُقبل: واجهة تعديل مادة ترسل `code` غير معروف في `SubjectPatch`; تعديل مرحلة ترسل الحقل نفسه؛ تعديل مهارة رئيسية ترسل `parentSkillId:""` فيرفضها الخادم وتغلق النافذة رغم الخطأ؛ نجاح Shard واحد رغم فشل بقية E2E؛ Security CI يحتوي `|| true` ويُسمى حاجزًا؛ نقص زر أرشفة مع الحفاظ على منع حذف السجل المرتبط.

## 2. استلام الجولة — 10 خطوات إلزامية

1. `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git fetch origin --prune` بعد حماية التعديلات المحلية؛ `git rev-parse origin/main`.
2. اقرأ قائمة PRs المفتوحة وما يتداخل معها من ملفات وحالات `mergeable` وchecks، واحفظ worktree/stash/backup دون الكتابة فوق عمل آخر؛ لا force-push بلا موافقة وحماية واضحة.
3. افحص آخر عقد Codax في الوظيفة المعنية، لا تعتمد فقط على أسماء مسارات أو توثيق تاريخي.
4. اقرأ سجل الفجوات/Checkpoint المحدث، واجعل الـIssue/PR الحالي هو مرجع الشريحة؛ لا تنشئ Master Plan جديدة.
5. عرّف Capability Slice واحدة: Role → Entry → User action → expected state → request → storage → consumer → failure/retry → permissions → visual states.
6. عرّف شروط قبول ذرّية قبل التعديل، وحدد ما هو `UNKNOWN`، وما يُطلب له قرار مالك خاص (خطر على البيانات/الإنتاج/الصلاحيات/المصاريف).
7. أنشئ إثبات RED من إعادة إنتاج فعلية؛ ميّز إخفاق المنتج عن إخفاق الاختبار وعن البيئة، ثم حدّد السبب الجذري حتى مستوى الحقل/السطر/الاستعلام.
8. أصلح بأقل Diff آمن وراجع التغييرات بنفسك؛ لا تحويل أعمى أو redesign.
9. نفّذ GREEN حسب مصفوفة الأدلة أدناه وأعد اختبارات الرحلات المتأثرة؛ لا نجاح كاذب عبر تعديل assertions أو mock أو timeout.
10. سلّم PR مع SHA وCI والأدلة وحدودها، وحدّث سجل الجرد والـCheckpoint. لا تتحول إلى شريحة جديدة مع وجود بوابة مانعة غير محسومة إلا بفصل صريح له أثر معروف.

## 3. تقسيم الوكلاء المختصين — منسق واحد، وكاتب واحد لكل نطاق

الموجّه/Orchestrator مسؤول عن توزيع المهام وجمع الأدلة وفحص النتائج، وهو أيضًا مسؤول عن ألا يلغي الوكلاء بعضهم بعضًا. شغّل الوكلاء حسب الحاجة، وليس جيشًا دائمًا:

- **Legacy & UX/RTL:** `almeaa-parity-checker`, `almeaa-rtl-browser-verifier`، مقارنة أصل/هدف على نفس الدور والبيانات والمقاسات.
- **API/Go & contract:** `almeaa-api-contract-validator`، تحقق strict JSON وstatus/error/CSRF/idempotency؛ تحقق من جميع DTOs المرسلة.
- **PostgreSQL/data integrity:** `almeaa-db-migrator`, `almeaa-content-taxonomy-guard` حسب الحاجة؛ الترحيلات والقيود والعلاقات وrollback.
- **Assessment/Learning:** `almeaa-learning-workflow-validator`, `almeaa-school-director-validator`؛ اختبارات الطالب والمحاولات والتصحيح والنتائج والإتقان.
- **Security/permissions:** `almeaa-rbac-audit`, `almeaa-commerce-tap-guard` للمتاجر/الاشتراكات؛ حسابات وأدوار ومدارس متعددة، fail-closed.
- **CI & delivery:** `almeaa-ci-health-monitor`, `almeaa-pr-controller`, `almeaa-release-orchestrator`؛ مراقبة الـSHA الصحيح وخطوط الجودة.
- **AI/safety & text:** `almeaa-ai-tutor-guard`, `almeaa-arabic-normalizer` عند مساس المهمة بالذكاء الاصطناعي أو النص العربي.
- **Reviewer مستقل:** لا يكتب على فرع المنفّذ؛ يراجع diff ضد العقد، يبحث عن اختبارات ناقصة أو عيوب أمنية، ويعيد findings قابلة لإعادة الإنتاج. يمكن أن يكون Codex أو DeepSeek Harness أو وكيل مستقل داخل Antigravity.

**العزل:** كل وكيل كتابة في Git Worktree خاص وفرع واضح؛ مهام القراءة يمكن توازيها. ممنوع تعديل الملفات نفسها بواسطة وكيلين دون مالك واحد واضح. ممنوع نقل commits قديمة جماعيًا أو دمج Draft PRs بغير مصالحة متطلبات المصدر.

## 4. أدوات التنفيذ والإضافة

استخدم الموجود أولًا: Git/GitHub CLI، Go toolchain، sqlc، PostgreSQL معزول، Playwright Trace/Screenshots/Network، TypeScript compiler، AST/codemods عند التكرار، أدوات فحص JSON contracts، `govulncheck`, `npm audit`, ESLint إذا كان معتمدًا، Lighthouse/k6 عند الشريحة المناسبة. لا تثبّت أو تُفعّل Plugin/Extension إلا بعد التحقق من المصدر الرسمي، والموثوقية، والرخصة، والإصدار المثبت، وأنه لا يطلب أسرارًا أو وصولًا زائدًا؛ يسمح بالتثبيت الآمن محليًا ضمن الصلاحيات المتاحة، وتُطلب موافقة صريحة لما ينشئ تكلفة أو يوسع الوصول أو يمس الإنتاج. سجّل الأدوات والإصدارات والأسباب وطرق التراجع.

## 5. مصفوفة اعتماد الشريحة

- **Contract:** طلب React يطابق decoder Go الصارم؛ ترميز/أنواع/عدم إرسال حقول immutable وomitted vs empty/null؛ 200/201، 400، 401، 403، 404، 409، 503.
- **Database:** PostgreSQL معزول ومهاجرات فعلية؛ نتيجة عمليات الكتابة مقروءة بعد Reload وبعد إعادة طلب؛ قيود العلاقات، transaction rollback، الاتساق بين الخدمات، عدم حذف محاولات/نتائج/استحقاقات.
- **Browser:** رحلة متصفح على React متصل بـ Go وPG (لا mock لعملية الاعتماد)، بالإضافة إلى Mock E2E المتخصص لاختبار حالات الفشل النادرة؛ 390/820/1440 RTL، back/refresh/slow/error/empty/retry/keyboard.
- **Access:** هوية وأدوار ومؤسسات/مدارس/فصول/موضوعات مختلفـة، منع القراءة والكتابة العابرة للنطاق، CSRF والجلسات، سجل audit صحيح.
- **Legacy:** مطابقة نفس إجراء المستخدم ونتيجته وصوره على بيانات مماثلة؛ لا نسخ أعمى أو تعديل UX دون موافقة.
- **Code & CI:** typecheck، build، go test، PostgreSQL migrations، الاختبارات المتأثرة وE2E واسع النطاق، فحص التبعيات، مراجعة مستقلة، exact-head checks. إذا كانت الـE2E العامة RED في baseline: أعد تشغيل baseline بنفس البيئة، قس regression، سجل جذور الأعطال؛ لا تسمِّ الـCI كاملًا أخضر، ولا تنشر إنتاجًا على أساس شريحة خضراء. أي استثناء من بوابة مطلوبة يحتاج سياسة موثقة وموافقة مستقلة ولا يجوز أن يخفي P0.
- **Deploy:** الدمج لا يعني النشر. تحقق من commit المنشور والـAPI/DB version على بيئة staging قبل أي قرار إنتاجي؛ الإنتاج وتغيير البيانات يحتاجان تفويضًا مستقلًا.

## 6. سجل التغطية وحالاتها

كل صف في Action Ledger يمثل إجراء وظيفيًا بحد أدنى:
`action_id | owner | source_sha | go_sha | role | route/page/tab | control | expected behavior | API method/path | DTO/OpenAPI | Go handler/service | DB effect | affected consumer | auth/scope | error/rollback | visual evidence | test type | evidence links | state | next action`.

الحالات: `VERIFIED` (دليل كامل بحسب المهمة)، `PARTIAL` (جزء مثبت)، `FAILED` (إخفاق مُعاد)، `UNKNOWN` (لم يُختبر)، `BLOCKED` (عائق محدد)، `NOT_APPLICABLE` (سبب موثق). لا قيمة لـ100% بلا مقام: عدد الإجراءات المعروفة × حالة اختبارها ومستوى دليلها.

## 7. ترتيب العمل والاستئناف

ابدأ من [حالة التنفيذ في الخطة](../migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md) و[نقطة الاستئناف](../migration/owner-handoff/2026-11-01/CHECKPOINT_AR.md). عند تداخل الفروع ثبّت المسؤول والملفات والـSHA، وابدأ عملًا مستقلاً داخل نفس الأولوية. حدّد مسبقًا ما يحتاج بيئة حقيقية وأي فحص ستشغله مرشحات CI على الرأس الحالي. لكل إجراء كتابة أو إرسال، أثبت نجاحه من الخادم وتحقق من أثره بعد القراءة والتحديث. سجّل فشل الخدمة بصيغة مفهومة مع بقاء المسودة أو إمكان إعادة المحاولة.

### سجل أولويات استلام #280

1. **PR #280 / G1:** أصلح/صنّف Frontend E2E على الثلاثة Shards (آخر نتيجة مفحوصة 645 PASS / 346 FAIL / 29 SKIP على `438b00721c`) بمقارنة نفس SHA والـbaseline الرئيسي وبفصل بيئة `8080` عن عيوب المنتج، وأعد exact-head؛ عالج security checks غير الحاجزة (`|| true`) بناءً على سياسة مخاطر قابلة للاختبار، ونسق مراجعة مستقلة. لا تدمج ولا تقل G1 closed مع بوابة مانعة.
2. **PR #279 / تجربة الطالب:** قَيِّم ببيئة Go/PG معزولة رحلة دخول الاختبار والصور/ترتيب الأسئلة/المؤقت/الحفظ/الاستئناف/التسليم/النتيجة/المراجعة/الرجوع/حالات الفشل؛ وازن بين client local resume وserver-side persistence ولا تدّعِ استكمالًا عبر الأجهزة ما لم ينفذ.
3. **Issue #259 / لوحة الإدارة:** صحح DTOs مثل `SubjectPatch`, `LevelPatch`, `SkillPatch` مع حماية البيانات، والأرشفة/الإخفاء/الاستعادة والحذف الآمن، وجرد CRUD لكل لوحات المدير.
4. **Issue #141 / الاعتماد الشامل:** استخرج جردًا حقيقيًا من Codax وGo، ووصل كل إجراء بالعقد والدليل، وأصلح بوابات E2E trigger/filter، واستمر على كل الأدوار.
5. **Pillars/OR:** راجع محاور الهندسة المضافة في #280؛ تحقق من اختلاف رقم «28» عن عدد البنود المفصلة A1–F4 في سياق كل إصلاح (الأداء، الأمان، التشغيل، UX، التعليم، الامتثال). لا تدّعِ أن ADR-0008 محرك MILP/CP-SAT منفذ؛ يُنفذ كميزة مستقلة عند وصول أولويتها.

هذه **أولوية مؤقتة تُحدث بحسب HEAD/الخطط المعتمدة**، وليست لائحة تسمح بتجاهل العطل الخطير الذي يكتشف في أي وقت. **ثبّت قواعد هذا الملف في `docs/engineering/ANTIGRAVITY_EXECUTION_STANDARD_AR.md` عبر PR حوكمة صغير مستقل، وأضف رابطًا موجزًا من `AGENTS.md` وإعداد Project Rules إن توفر، ليقرأه أي وكيل في كل جلسة من Git HEAD الحالي؛ لا يعتمد استمرار التعليمات على تاريخ المحادثة.**

## 8. الإبلاغ والشفافية

التحديثات القصيرة: `Slice | Git SHA | PASS/FAIL/SKIP | real API/DB? | open blockers | next concrete command`. لا تملأ السياق برسائل انتظار؛ لا تعد بالعمل في الخلفية إلا إذا كان هناك Scheduler مفعل فعليًا. عند نهاية الجولة قدّم روابط PR/CI/Trace/صور، ما تم على الجهاز وما رفع وما دمج وما نشر بوضوح. إذا تعطل الوصول، احتفظ بنقطة استئناف دقيقة وبالنتيجة الجزئية، لا تخترع Green.

## 9. حماية ممارسات الفريق

لا تغير أدوار الطلاب أو درجاتهم أو نتائجهم أو عمليات الدفع أو ترتيب المحتوى لمجرد نجاح اختبار. لا حذف تسلسلي لتجاوز علاقات FK، ولا تحرير لبيانات Legacy أو الإنتاج. لا تستخدم مخرجات Agent كدليل دون مراجعة الشيفرة والاختبار. لا تجعل قواعد هذا الملف أساسًا لمزيد من الخطط المتنافسة؛ اربطه من `AGENTS.md` باختصار وحدث جرد العمل الموجود بدل إنشاء نسخة جديدة منه.
