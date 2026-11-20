# ALMEAA Go — نقطة استئناف استلام المالك (2026-11-04)

> وثيقة حالة **تابعة** للمرجع التنفيذي `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md`، ولعقد `OWNER_BATCH_DELIVERY_CONTRACT_AR.md`، وIssue #141. ليست خطة رئيسية جديدة، وليست شهادة جاهزية أو إذن نشر.
>
> **العقد المنتج:** واجهة وسلوك Codax الأصليان مرجع المطابقة، مع Go/PostgreSQL/React كأساس داخلي أكثر صلابة. يجوز اقتراح تحسينات أو وظائف إضافية بشرط توثيق سببها واختبارها وعدم إلغاء أو تغيير سلوك أصلي بلا موافقة المالك؛ لا تُستخدم التحسينات لتبرير فقد الوظائف الأصلية.

## 1. المصدر والحالة المثبتة

| المصدر | آخر baseline مفحوص لهذه الجولة | استخدامه |
|---|---|---|
| Legacy `nasef6464/almeaacodax` | `main@59132449d64ec604f75e4a0954349fa8258524a9` | **قراءة فقط**، المرجع البصري/الوظيفي والصلاحيات القائمة |
| Go `nasef6464/almeaago` | `main@29593d18825e1691b38eae444a90084c1d5ad2f4` | المستودع الوحيد للتنفيذ، تحت فروع وPRs |
| Gemini visual evidence | `delivery/g1-student-visual-walkthrough-report-42` | 29 ملفًا مقارنة بـmain وقت التحقق: 25 PNG + 2 MD + 1 MJS + 1 JSON |

لا تفترض أن أي رأس هنا هو الأحدث مستقبلًا؛ أعد فحص Git/CI/PR قبل كل دفعة. **الصور التي سلّمها Gemini تجرّب Go بــFull Mocks** بحسب `MOCK_VS_REAL_CLASSIFICATION_AR.md`، رغم وجود تقارير تستخدم تعبير «حي»؛ لا ترقَّها إلى دليل تكامل PostgreSQL أو مقارنة متقابلة مع Codax.

سجل التسليم: `docs/migration/GEMINI_CURRENT_HANDOFF_AR.md`. التقرير `42_STUDENT_LIVE_EXPERIENCE_AND_VISUAL_WALKTHROUGH_REPORT_AR.md` موجود في فرع أدلة Gemini، وليس دليلًا عامًا لإغلاق G0–G6. تُصنف الملفات/القدرات `IMPLEMENTED/VERIFIED/PARTIAL/UNKNOWN/FAILED/BLOCKED` حسب نطاق الدليل وSHA.

## 2. أعمال منجزة في الجولة الهندسية الحالية — لا تُكررها

1. **PR #264 — مسار/مادة: كذب إشعار الأرشفة.** فرع `fix/admin-taxonomy-archive-truth-20261104`: عند فشل PATCH لم تعد نافذة التأكيد تغلق أو يظهر نجاح كاذب. `patchStatus()` يعيد نتيجة `run()` ويظهر الخطأ ويسمح بإعادة المحاولة. اختبار Playwright جديد عند 390 و1440 لمسار ومادة، 503 ثم نجاح بعد إعادة الطلب. **لم يُعتمد كدمج**: يجب فحص E2E وCI والرأي المستقل على رأس الفرع.
2. **PR #265 — جرد API وFrontend CI.** فرع `fix/api-mount-inventory-35-20261104`: جرد `server.go` الفعلي أصبح 35 mount (كان الاختبار يتوقع 33)، مع 35 جذرًا مميزًا. Legacy snapshot ما زال 33/30؛ الجذور المشتركة `/api/quizzes` و`/api/school-access`. يثبت الاختبار الجديد ملكية `deps.Search` و`deps.PublicArticles` و`deps.Quizzes` للمسارات الإضافية. هذا **جرد تسجيلات** فقط لا يثبت تكافؤ السلوك. CI الخاص بهذا الفرع يحتاج مراجعة قبل دمج أي شيء.
3. **تسجيل العيوب في مواضعها الأصلية** دون إنشاء خطط منافسة: Issue #259 (إدارة المحتوى)، #261 (الطالب/الاختبار)، #260 (المعلم/المشرف)، والمرجع الأعلى #141.

لا تدمج آليًا، لا ترفع الصور أو الأدلة الحساسة إلى `main` مباشرة، ولا تخلط فروع ملفات Gemini مع فروع الإصلاح.

## 3. قائمة عيوب المالك — أدلة الكود مقابل ما يحتاج إعادة إنتاج

| ID | أولوية | أثر المالك | دليل كودي مثبت | شرط الإغلاق التالي |
|---|---|---|---|---|
| ADM-PATH-DELETE-001 | P0 | إضافة المسار تعمل؛ حذف/إزالة المسار لا ينتج الأثر المنتظر | Legacy `dashboards/admin/PathsManager.tsx` يطلب `deletePath`؛ Go `TaxonomyAdminPage.tsx` يستخدم PATCH `status='archived'`؛ إشعار النجاح الكاذب أصلح في PR #264 | توثيق سياسة الأرشفة مقابل الحذف، اختبار فشل/نجاح Go مع PG معزول، اختفاء المسار عن الطالب بعد Reload، الحفاظ على التسجيل والدرجات التاريخية، رفض غير المدير |
| ADM-SUBJECT-DELETE-002 | P0 | إضافة مادة تعمل، وإزالتها لا تعمل كما يتوقع المدير | Go مسار `updateSubject` يستخدم الأرشفة؛ نفس خطأ تأكيد النجاح في PR #264 | اختبار الحفظ والتصفية/العزل والاستحقاق والظهور لكل مستهلك، عدم حذف نتائج تاريخية، رفض 403 |
| ASM-NAV-003 | P0 UI | أرقام الأسئلة ينبغي أن تظهر في لوحة جانبية يسار الاختبار | Legacy `pages/QuizPage.tsx` عند ~1629 و~2050 لديه `lg:grid-cols-12` وبطاقة «لوحة الأسئلة» بخمس أعمدة؛ Go `AssessmentAttemptPage.tsx` يستخدم شريطًا أفقيًا أسفل بطاقة السؤال | صور Legacy/Go متكافئة عند 390/820/1440؛ تنقل صحيح وحالات سؤال حالي/مجاب/للمراجعة، مع RTL وتقسيم الأقسام وعدم سقوط تفاعل الشاشة |
| ASM-MEDIA-004 | P0 | صورة السؤال لا تظهر كما في القديم أثناء الحل أو تأليف/اختيار الأسئلة | Go يستخدم بالفعل `QuestionAssetImage` في `AssessmentAttemptPage.tsx` و`QuestionBankAdminPage.tsx` ويملك `imageAssetId` و`assetId`؛ السبب **غير محسوم** | تتبع سؤال مصور حقيقي عبر source DTO→Go question version→attempt payload→media GET→render، وصور خيارات داخل صورة السؤال، ومعاينة منشئ الاختبار؛ قارن PR #262 قبل إضافة مكونات |
| ROLE-TEACH-005 | P0/P1 | لوحة المعلم مختلفة وبها وظائف مفقودة | Go `TeacherWorkspacePage.tsx` يعطل معظم التبويبات عبر `aria-disabled` عدا النظرة العامة والفصل الذكي في سياق محدد؛ Legacy `dashboards/SchoolTeacherDashboard.tsx` يفعّل رحلات عديدة | جرد كل تبويب وتحويله لرحلة حقيقية دون اختراق صلاحيات المدرسة؛ واجهة Legacy مطابقة على ثلاث شاشات؛ HTTP/PG/E2E |
| ROLE-SUP-006 | P0/P1 | لوحة المشرف تختلف كثيرًا عن الأصل | Go `SupervisorDashboardPage.tsx` يجيز `overview` و`students` فقط بينما Legacy `dashboards/admin/SupervisorDashboard.tsx` يضم `skills/reports/tests/live-sessions/live-monitoring` | فحص الصلاحيات ومصدر البيانات والتقارير والاختبارات والمدارس لكل تبويب؛ عدم تفعيل واجهة شكلية؛ E2E متعدد الأدوار |
| OPS-BACKUP-007 | P0 | الاستعادة والنسخ تبدوان جاهزتين دون تنفيذ فعلي | مراجعة كود `BackupAdminPage.tsx` السابقة رصدت بيانات وحفظ/استعادة محاكاة | منع النجاح الوهمي ثم تنفيذ API/DB backup/restore flow آمن مع dry-run وتفويض وAudit؛ لا اختبار على إنتاج |
| OPS-INTEGRATIONS-008 | P0 | حفظ إعدادات التكاملات الظاهر ليس حفظًا حقيقيًا | مراجعة `PlatformIntegrationsAdminPage.tsx` السابقة وجدت `setTimeout` ورسالة نجاح بدل HTTP | GET/PATCH حقيقة + رفض 403 + إعادة قراءة بعد reload، دون كشف secrets |
| STU-SESSION-009 | P1 | جلسة طالب تجريبية عند غياب Auth | `StudentDashboardPage.tsx` يحتوي fallback demo | auth-only أو guest state صادق، لا حفظ بهوية وهمية |
| COURSES-PROGRESS-010 | P1 | تقدم الدورات يعرض أصفارًا ثابتة | `CoursesPage.tsx` يستخدم progress/lessonsCount صفريًا | ربط التقدم الحقيقي وحالة enrolled/active/completed من Go مع اختبار Reload |
| QA-REGRESSION-011 | P1 | اختبارات الوجود قد تمر رغم فشل الوظيفة | `codax-parity-master.spec.ts` يختبر عناصر بصورة سطحية | assert فعل/طلب/نتيجة/حفظ وصلاحيات؛ لا `toBeDefined()` كشهادة مطابقة |

**حالات هذه القائمة:** ملاحظات المالك حقيقية كإبلاغ؛ المواضع المصدرية أعلاه فُحصت قراءةً. الحكم السلوكي النهائي/سبب العطل يحتاج تشغيل بيانات اختبار. أي بند لم يثبت بفحص متصفح حقيقي يبقى PARTIAL/UNKNOWN، لا VERIFIED.

## 4. بروتوكول التنفيذ المستمر — يطبق على كل شريحة

1. **Preflight:** Git SHA + status + PR/ownership + CI + فهم `AGENTS.md` و`docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md`. لا تنسخ حالات نجاح من SHA قديم، ولا تفقد تغييرات محلية لـGemini.
2. **اكتشاف ثنائي:** Codax للقراءة فقط (الأصل: route, UI, state, handler, access, data)، وGo (route, component, HTTP client, transport, application, repository, SQL). استعمل AST/codemods للمتكرر فقط بعد عينة قابلة للاختبار.
3. **عقد رحلة واحد:** Actor → screen/action → request → auth/scope → Go domain → PG/provider → UI & downstream consumer، ومعيار قبول مستقل لكل فعل والحالات loading/empty/error/disabled.
4. **RED → GREEN:** اختبار يكشف العطل، تعديل أصغر مسؤولية داخل موديولها، اختبارات قصيرة أولًا، ثم Go/PG معزول، ثم browser وvisual وCI. لا تخفف assertions أو تصنع لقطات Go كمرجع Legacy.
5. **مرجع الصورة:** أصل/هدف/فرق لكل دور وحالة وviewport 390/820/1440 بنفس browser version/font/DPR/zoom/fixtures، واختبار القوائم والحوارات والتمرير والـRTL. فرق صغير قد يكون مقبولًا فقط بموافقة موثقة، وليس تخمينًا.
6. **سلطات وحفظ:** 401/403/CSRF، مدارس وفصول ومعلم مفوض وغير مفوض، حفظ ثم تحميل جديد وReload وحالة خطأ وإعادة محاولة، عدم تسريب البيانات. لا تُستخدم Neon إلا إذا ثُبتت بيئة staging المعزولة وخطر الكتابة مقبول.
7. **مراجعة مستقلة:** فرع واحد مالك ملف واحد، PR مركز، تقرير tests/exact head، حكم RETURNED/ACCEPTED/PARTIAL. لا دمج/نشر إنتاجي بلا بوابات كاملة وصلاحية.
8. **إغلاق ونقطة استئناف:** حدّث Issue #141 وما يتفرع عنه، هذه النقطة عند تغيير الاستنتاجات، وروابط الأدلة والـSHA. لا تكرر جردًا شاملاً في كل جلسة، ولا تدعِ فريقًا يعمل في الخلفية بلا تنفيذ فعلي.

## 5. التبعيات والترتيب

- **الانطلاق السريع:** إثبات CI الحالي ومعالجة أسباب الفشل دون إسكات الاختبار؛ PR #265 ليس سوى بوابة Frontend جزئية.
- **سلامة البيانات/الثقة:** أرشفة المسارات/المواد، ثم النسخ والاستعادة والإعدادات الوهمية. إذا تطلب حذفًا نهائيًا يؤثر في enrollments أو attempts، فقرار دومين/أمان صريح أولًا.
- **واجهة الاختبار:** نقل التخطيط الجانبي للترقيم من Legacy بعقد Responsive، ثم التحقق من صور السؤال والخيارات من Go Media؛ راجع #262 لمنع التكرار.
- **الأدوار:** Teacher ثم Supervisor ثم Parent/Director حسب التبعيات، كل دور بسلوك كامل وصلاحيات وبيانات وحفظ وصور، لا قوائم معطلة.
- **الشمول:** يُتابَع باقي النطاق وفق #141 و`03_EXECUTION_AND_HANDOFF_PLAN_AR.md`: Public/Auth → Admin/Content → Student/Learning/Assessment/AI → Schools/Reporting/Commerce → Ops/Data → Final.
- **اعتماد الأداء والتحسين:** قارن Web Vitals، أحجام bundle والطلبات، P95 latency، استعلامات SQL، load test آمن وaccessibility؛ لا تعد بتفوّق Go مطلق قبل أرقام مناظرة.

## 6. تنسيق الوكلاء والجدولة قليل التكلفة

أدوار منطقية: Legacy explorer (read-only)، Go explorer، UI implementer، Go/PG implementer، browser QA، RBAC auditor، مستقل PR reviewer. يمكن أداؤها تسلسليًا إن لم تتوفر بيئة وكلاء. لا يكتب وكيلان في ملف واحد. نفّذ slices قصيرة بدل سرب نماذج يستهلك الحصص.

استعمل GitHub Actions على push/PR وselective tests مع cache؛ احتفظ بالآثار المشروطة بالفشل. تم إنشاء **متابعة GitHub اليومية** للتحقق من تغيّر CI/PR وتسليم Gemini فقط؛ هي متابعة read-only لا تدمج أو تكتب. لا تضف عشرات جداول مستقلة لنفس SHA أو نفس العطل.

## 7. مراجع الاستئناف

- غرفة القيادة: https://github.com/nasef6464/almeaago/issues/141
- إدارة المحتوى: https://github.com/nasef6464/almeaago/issues/259
- التقييم والطالب: https://github.com/nasef6464/almeaago/issues/261
- المدارس/الأدوار: https://github.com/nasef6464/almeaago/issues/260
- إصلاح الأرشفة: https://github.com/nasef6464/almeaago/pull/264
- جرد API/CI: https://github.com/nasef6464/almeaago/pull/265
- صور الخيارات قيد مراجعة: https://github.com/nasef6464/almeaago/pull/262
- تسليم Gemini: الفرع `delivery/g1-student-visual-walkthrough-report-42`، راجع PR الفعلي عند ظهوره.

**قاعدة الاستلام لأي منفذ لاحق:** أعد فحص GitHub أولًا؛ لا تكتب فوق عمل جاري، ولا تساوِ التقرير بشهادة مطابقة، ولا تكرر خططًا أو مكونات موجودة قبل تمييز ما ينقص بالفعل.
