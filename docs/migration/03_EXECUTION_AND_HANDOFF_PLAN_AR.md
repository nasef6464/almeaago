# خطة نسخ ALMEAA من Node.js إلى Go — التنفيذ والتسليم

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Each code slice follows test-driven development and the repository's CI/PR rules.

**الحالة:** PLAN / STARTING CHECKPOINT — وثائق فقط، لا تعديلات منتج أو ترحيل بيانات.  
**التاريخ:** 2026-10-26.  
**الهدف:** نقل أحدث واجهات وسلوك وبيانات وعلاقات `almeaacodax` إلى `almeaago` مع تجنب إعادة العمل في الوظائف المكتملة، وإثبات تكافؤ كل رحلة مستخدم.

**Architecture:** React presentation parity فوق دومينات Go الحالية. PostgreSQL سلطة البيانات، وR2 للملفات. المصدر القديم read-only، الجديد هو مستودع التنفيذ الوحيد.  
**Tech Stack:** Node/React/Express/Mongo للمقارنة؛ Go/React/PostgreSQL/Redis/R2/OpenAPI/WebSocket للتنفيذ.  
**Specs:** `01_LEGACY_SOURCE_CONTRACT_AR.md` و`02_GO_TARGET_CONTRACT_AR.md` ووثائق `../blueprint/` و`../architecture/VISUAL_PARITY_POLICY.md`.

## Global Constraints

- أحدث Legacy `main` بعد إعادة فحص SHA هو مرجع الشكل والسلوك المثبت؛ لا تعتمد Blueprint سبتمبر وحده.
- لا تكتب في Legacy ولا في production data. احفظ الحالة السابقة وأي دليل قبل أي migration لاحقة.
- Membership ≠ Entitlement؛ teacher assignment + material/school/class scope إلزامي حيث ينص أحدث المصدر؛ صلاحيات كل mutation في الخادم.
- التقييم والدرجات والإتقان حقائق محددة بخادم الدومين، لا واجهة أو AI.
- صورة السؤال وسجله canonical، ولا استنساخ للأسئلة/الصور عند الاختبارات.
- لا إعلان `PARITY_PROVEN` من green CI فقط؛ يلزم visual/functional/external/release evidence.

## ترتيب البرنامج — عمل متداخل مع بوابات واضحة

| المرحلة | المخرج | معيار الخروج |
|---|---|---|
| P0 — تجميد المقارنة | SHA الطرفين، inventory شامل، مصفوفة Routes/Roles/API/DB/UI | لا مجال رئيسي مجهول الملكية، والمجهول موسوم UNKNOWN |
| P1 — المدارس أولًا | ملف SCHOOL-001 لكل قسم وحالته وجداول/أوامر/لقطات | خريطة قابلـة للاختبار، ليست مجرد قائمة أسماء |
| P2 — تنفيذ المدارس | دفعات: نطاق/تكليف → شاشة المدير → اختبارات وتقارير → حصص وتدخل | اختبارات نجاح ورفض، CI، parity screenshot لكل دفعة |
| P3 — المحتوى والتعلم والاختبارات | جرد وGap ثم إصلاحات محددة | نفس الأسئلة/الإتاحة/الدرجات/المراجعات |
| P4 — المعلم الذكي/الحصص/التقارير | مضاهاة جميع الحالات/مزودي الخدمة | فصل AI عن التصحيح وصحة المصادر والنطاق |
| P5 — التجارة والإدارة والعمليات | صلاحيات وإعدادات ومدفوعات وواجهة الإدارة | idempotency/audit/access والواجهات |
| P6 — ترحيل بيانات تجريبي | Mongo export آمن → mapping → PG staging → reconciliation | counts + IDs + references + hash + rollback drill |
| P7 — اعتماد نهائي | responsive / E2E / load / security / DR / external providers | Go production parity evidence، ثم cutover بإذن منفصل |

لا يلزم انتظار اكتمال كل P0 لإصلاح خلل حرج مثبت، لكن لا تنفذ مجالًا مجهول المواصفات. مراحل التنفيذ تتداخل بقدر يحفظ السلطة والتتبع؛ لا تقفز من تشابه صور إلى إغلاق API.

## Review Focus — أخطاء لا يجوز أن تفلت

1. **تغيير المدرسة/المادة خلال طلب بطيء:** لا يعرض/يحفظ نتيجة السياق السابق. E2E مع responses معكوسة الترتيب.
2. **تكليف مادة متعارض/ملغى:** لا يعيد فتح سؤال أو تقرير أو فصل؛ اختبارات 403/deny وواجهة التصحيح.
3. **محاولة/دفع/نقل مكرر:** لا ينشئ نتيجة أو grant أو membership مكررة؛ integration idempotency.
4. **سؤال بصورة أو خيارات مدمجة:** تطابق الحروف/الإجابة/القص/المقاس على كل viewport؛ E2E + screenshot.
5. **تقرير متعدد المصادر/طالب من مدرسة أخرى:** لا خلط ولا نتائج مزيفة أو كشف بيانات؛ API integration وE2E.

## Task 1 — حفظ baseline قابل لإعادة الإنتاج

**Files:** `docs/migration/01_LEGACY_SOURCE_CONTRACT_AR.md`, `02_GO_TARGET_CONTRACT_AR.md`, `03_EXECUTION_AND_HANDOFF_PLAN_AR.md`; لاحقًا `docs/migration/evidence/` للفهرس دون أسرار.

- [ ] عند كل جلسة سجّل `git rev-parse HEAD` لكل مستودع و`git status --short` واحفظ PR/CI الحية ذات الصلة؛ لا تفترض أن SHAs هذه الوثيقة أحدث HEAD دائمًا.
- [ ] اقرأ `../CURRENT_STATE.md`, `../blueprint/00_MASTER_INDEX_AR.md`, `../architecture/PROJECT_MAP.md`, وملف المصدر الخاص بالمجال.
- [ ] ابنِ inventory مبرمجًا من route/menu/API/model definitions على الطرفين، ثم راجعه يدويًا، وسجّل كل عقد غير محسوم UNKNOWN.
- [ ] تحقق من الروابط والمسارات، ولا تخلط الجرد الإحصائي بإثبات السلوك.

## Task 2 — SCHOOL-001 Contract Trace (أول دفعة)

**Files to inspect in Legacy:**
- `dashboards/SchoolDirectorDashboard.tsx`
- `dashboards/school-director/directorNavigation.ts`
- `dashboards/school-director/DirectorTeacherAssignments.tsx`
- `dashboards/admin/SchoolsManager.tsx`, `dashboards/SchoolTeacherDashboard.tsx`
- `server/src/modules/schools/application/teacherMaterialPolicy.ts`, `teacherMaterialScope.ts`, `schoolDirectorWorkspace.ts`
- related `quizzes` and classroom/report route owners resolved by call tracing.

**Files to inspect in Go:**
- `apps/web/src/features/organizations/pages/SchoolDirectorDashboardPage.tsx`
- `apps/web/src/features/organizations/api/organizations-client.ts`
- `internal/organizations/domain/{director_core,school_contract}.go`
- `internal/organizations/{application,repository/postgres,transport/http}`
- `internal/{assessment,reporting,realtime,learning}` and `migrations/` as called.

- [ ] سجل كل قسم من قائمة المدير العشرة، لكل دور/صلاحية/وحدة عقد، مع URL وأوامره وتصميمه.
- [ ] ارسم لكل أمر سلسلة `React event → client → HTTP → service/policy → repository → PG → event/report`؛ سجل شكل الخطأ ومتى يعاد تحميل الصفحة.
- [ ] راجع قاعدة مادة المدرس بالذات: اختياري في واجهة Go الحالية مقابل مادة صريحة وفشل مغلق في Legacy؛ أثبت حكم Go الخادمي قبل كتابة تعديل.
- [ ] أخرج matrix `legacy_id | legacy_SHA | legacy_file | Go_file | API | table | parity_status | test | evidence | owner`.
- [ ] رتب الفجوات حسب P0 (سلطة/تسريب/درجة)، P1 (وظيفة مفقودة)، P2 (شكل/حالة)، P3 (تحسين اختياري ممنوع إدخاله صامتًا).

## Task 3 — تنفيذ أول Slice بعد ثبوت الفجوة

**مرشح مبدئي:** تكليفات المواد وإظهارها للمدير، لكن لا يصبح نطاقًا معتمدًا حتى يثبت gap في الخادم والواجهة من Task 2.

- [ ] اختبار Backend سلبي أولًا: رفض مادة فارغة/متعارضة، وسحب السلطة بعد التعطيل، وعدم اتساع نطاق مدرسة ثانية.
- [ ] اختبار Frontend/E2E أولًا: اختيار مادة من كتالوج موثوق، تنبيه/إيقاف تعارض، لا input ID حر إذا المصدر يمنعه.
- [ ] نفّذ أصغر تغيير داخل `organizations` مع adapters واجهة؛ لا تعدّل API إلا بفجوة حقيقية مثبتة.
- [ ] نفّذ gofmt + go test للنطاق، Frontend unit/build + Playwright، Database migration checks إن تغير المخطط.
- [ ] صور Legacy/Go بحالات role/state مطابقة وبالمقاسات المحددة، وراجع الفروق البشرية لا الرقم فقط.
- [ ] حدّث matrix مع commit + tests + CI exact-head؛ افتح PR صغيرًا، ولا تنشر/تدمج مع فشل مطلوب.

## Task 4 — توليد واستكمال الخرائط المتبقية

- [ ] Admin: القائمة الكاملة ثم مدارس/طلاب/مدربون/بنك/اختبارات/محتوى/مالية/AI/إعدادات.
- [ ] Teacher/Supervisor/Parent/Student: كل قسم وكل وصول متبادل؛ اختبر المستخدم متعدد السياقات.
- [ ] DB: models/relations/indexes من Mongoose ↔ migrations/sqlc/constraints في Go، مع سياسة الاستيعاب والتكافؤ لا أسماء فقط.
- [ ] External: R2, Redis, queues, payments, WhatsApp/Google, AI, YouTube؛ وثق الأسرار المطلوبة دون طباعتها.
- [ ] UI: route+state+viewport matrix، مع screenshots آلية في CI للصفحات الثابتة وstaging الحية حين تتوفر صلاحياتها.

## GitHub Actions والتكلفة

الموجود حاليًا في Go: `.github/workflows/backend.yml`, `database.yml`, `frontend.yml`, `frontend-e2e.yml`. **لا تنشئ Workflow آخر الآن**؛ وسّع الاختبارات المستهدفة ضمن البوابات القائمة إن لزم. تجنب تشغيل screenshot suite على كل تغيير وثائق، واستخدم fixtures حتمية وحفظ artifacts لفترة محدودة. أي workflow جديد يحتاج بيان غرض، استهلاك، أذونات minimum ووقت تشغيل وrollback قبل PR.

## صلاحيات مطلوبة ومتى

| المرحلة | المطلوب | الآن؟ |
|---|---|---|
| جرد GitHub والكود | قراءة المستودعين | متاحة للفحص الحالي |
| إنشاء PR في Go | كتابة فرع وصلاحية PR | عند بدء كود التنفيذ فقط؛ لا حاجة لتغيير main مباشرة |
| لقطات الواجهة المحمية | حسابات اختبار لكل دور في بيئة staging آمنة أو fixtures وبيانات معقمة | لاحقًا عند التصوير التفاعلي |
| قاعدة البيانات | نسخة test/staging وحق read على schema أو export معقم، دون credentials في المستند | عند ترحيل البيانات/إثبات التنفيذ |
| التكاملات الخارجية | Sandbox/provider credentials مخزنة بأمان | عند اختبارات Google/WhatsApp/الدفع/AI |
| الإنتاج | إذن نشر/cutover ونسخ احتياطي مؤرخ | ليس الآن |

## سجل التقدم الإلزامي — يقرأه كودكس في بداية كل جلسة

آخر لقطة فحص: Legacy `bf7281f`, Go `a9d5af9` بتاريخ 2026-10-26.  
**منجز في هذه الدفعة:** توثيق عقد المصدر، عقد الهدف، وبروتوكول المراحل وحالات الشاشة؛ تم تحديد فرق ظاهر في واجهة تكليف المادة.  
**غير منجز:** inventory آلي شامل، صور UI حديثة كاملة، اختبار مرئي طرفي، إصلاح Go، PR/CI/نشر، تصدير DB.  
**الخطوة التالية بالضبط:** Task 1 ثم Task 2 SCHOOL-001؛ لا تقفز لنسخ الواجهة قبل فحص صلاحية المدرس/المادة في Go.

### قالب تحديث كل دفعة

`date | legacy SHA | go base/head SHA | area/slice | verified evidence | tests & CI run IDs | source changes | gap status | PR | blockers | next exact action`.

**النجاح النهائي:** طالب/معلم/مدير لا يلاحظ اختلافًا مقصودًا في الواجهة أو الوظيفة أو النتائج بين النظامين، وتثبت الفحوص عزل الصلاحيات وسلامة العلاقات والأداء على بيانات مماثلة؛ لا يُعد الوصف وحده دليلًا.
