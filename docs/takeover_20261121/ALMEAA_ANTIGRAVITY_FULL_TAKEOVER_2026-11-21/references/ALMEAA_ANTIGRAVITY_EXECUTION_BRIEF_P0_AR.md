# أمر تنفيذي مُحكم لوكيل Antigravity / DeepSeek / Codex — ALMEAA P0 Recovery

**تاريخ المراجعة:** 21 نوفمبر 2026. **وضع التنفيذ:** تقرير فحص حقيقي + أوامر عمل؛ ليس شهادة اكتمال.

## 0) نطاق العمل والمرجع

- المستودع الوحيد المسموح تعديل تنفيذه: `nasef6464/almeaago`.
- Legacy المرجع للقراءة والمقارنة فقط: `nasef6464/almeaacodax`.
- SHA الجديد المفحوص: `df538daa98e6615ed5c5d3265c9ab53ddd1cc35b`؛ SHA القديم المفحوص: `ed28102d7084899856de0371dc2c93a3d602d518`. **حدّث الاثنين فور البدء**؛ لا تفترض بقاءهما.
- الخطة العليا الوحيدة: `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md`. وثائق `AGENTS.md` و`docs/ENGINEERING_COMPLETENESS_CHECKLIST_AR.md` و`docs/migration/OWNER_BATCH_DELIVERY_CONTRACT_AR.md` وشروط المنتج مرجع تابع.
- الهدف: استقرار الرحلات الأساسية ثم استعادة التكافؤ مع القديم وحماية البيانات/الصلاحيات؛ لا rewrite، ولا تغيير صامت في scoring/mastery/entitlements/payment.
- ممنوع الكتابة في Legacy أو النشر أو الترحيل على بيانات حقيقية أو دمج PR لا يملك الأدلة المطلوبة.

## 1) المشكلات التي ثبتت من الفحص

### P0-A — فشل واسع في Frontend E2E

GitHub run: https://github.com/nasef6464/almeaago/actions/runs/44890325571

الشظايا الثلاث: **606 نجحت، 385 فشلت، 29 تخطيت**. من تحليل نص أخطاء Playwright الأولية: **312 فشل assertion/locator، 48 timeout، 22 `net::ERR_BLOCKED_BY_CLIENT`، 3 أخطاء أخرى**. **هذه أعداد أعراض لا عدد علل مستقلة**. أكبر الملفات المساهمة في الفشل: 
- `tests/e2e/track4_enterprise_ai_system.spec.ts`: 95
- `tests/e2e/track3_hybrid_access_interactive_video.spec.ts`: 67
- `tests/e2e/track2_schools_contracts_modules.spec.ts`: 48
- `tests/e2e/enterprise_b2b_journeys.spec.ts`: 24
- `tests/e2e/track1_schools_acquisition.spec.ts`: 17
- بجانب فشل أدوار المدارس والأهل والطالب والاختبارات.

**إشارات دقيقة من السجل:**
1. `admin-and-learning-spaces-complete.spec.ts:309`: لا يظهر نص `علاقة الجزء بالكل والسببية` في حالة foundation topic المعنية. راجع بيانات الـfixture ونطاق الـtopic والعرض الحقيقي في الأصل ثم API، ولا تضف نصًا ثابتًا فقط لإنجاح الاختبار.
2. `auth-single-dialog.spec.ts`: `page.goto('/login')` يرجع `ERR_BLOCKED_BY_CLIENT` في عدة مقاسات. حلّل سبب اعتراض الطلب/المتصفح أو routing/fixtures قبل تعديل assertions؛ لا تُلغِ سيناريو المصادقة.
3. `organizations-school-report-parity-retry.spec.ts:56`: انتظار زر `اختبارات المدرسة` داخل navigation باسم `أقسام لوحة مدير المدرسة` حتى timeout. تحقق هل زر مفقود، صلاحية/contract أم اختبار قديم/اسم accessibility؛ حافظ على أصل الوظيفة.
4. `student-report-scope-failure.spec.ts:82`: عنصر `اختبار القدرات` لم يظهر. تحقق من بيانات التقرير وبروتوكول fetch والسياق الحالي ومنع البيانات القديمة من المدرسة/المسار السابق.
5. أخطاء `vite proxy ECONNREFUSED 127.0.0.1:8080` أثناء E2E؛ `apps/web/playwright.config.ts` يبدأ Vite على 5173 فقط ولا يشغّل Go API. قد تكون الطلبات غير المموهة متوقعة أو سببًا لبعض الفشل؛ أثبت العلاقة قبل الاستنتاج.
6. مثال `strict mode violation` لأن الزر `تقرير الأسبوع` طابق عنصرين؛ افحص الازدواج في DOM/semantics أو locator قديم ولا تستخدم `.first()` عشوائيًا.

**العمل المطلوب:** استخراج `trace.zip` و`screenshot` و`error-context.md` من artifacts لكل مجموعة، ثم إنشاء ROOT_CAUSE_MATRIX:  test → expected legacy behavior → actual Go behavior → API/fixture/network evidence → root cause → fix owner → negative test → status. صنّف كل فشل: `ENV_INFRA`, `FIXTURE`, `TEST_DRIFT`, `ACTUAL_REGRESSION`, `LEGACY_GAP`, `PROPOSED_ONLY`, `UNKNOWN`. لا تفترض أن اختبارات “Track 1–4” كلها وظائف أصلية معتمدة؛ راجع Blueprint والحالة INTENDED/PROPOSED قبل إضافة وظائف جديدة.

### P0-B — الدمج والـCI غير متوافقين مع شهادة أخضر

- `main` كان على `df538daa` بعد PR #278، وFrontend/Database CI نجحا عليه. **لا يوجد من هذه النتائج إثبات أن Backend CI وإجمالي E2E أخضر على هذا الرأس**.
- PR #278 دُمج قبل انتهاء E2E الخاص برأس الفرع `3bad5fca` الذي فشل بعد ذلك. افحص branch rules وrequired checks والتعليق وقت الدمج دون الجزم بتجاوز متعمد؛ أضف Gate يمنع الدليل المضلل.
- PR #276 دمج أجزاء من Codex وAntigravity ويجب عدم إعادة تنفيذها.
- 9 PRs ما زالت مفتوحة في لقطة الفحص، منها #271 و#273 و#274. #274 مبني فوق #273 وليس main؛ لا تنفذ merge تلقائيًا لفروع متباعدة. قارن `main..branch` وأزل ما دخل بالفعل في #276 ثم انقل فقط الفجوات المؤكدة إلى فرع حديث.

**العمل:** سجل PR_RECONCILIATION لكل PR: `MERGED_ALREADY`, `SUPERSEDED`, `STILL_NEEDED`, `CONFLICT`, `BLOCKED`, مع evidence وأقصر تصرف صحيح. عرّف مجموعة required checks تشغيلية لا تُعتمد `SKIPPED` فيها باعتبارها نجاحًا، واضبط CI path filters بحيث لا تتجاوز اختبارات حساسة.

### P0-C — المحاور الهندسية غير مثبتة على GitHub

- الملف المعلن عنه `docs/ALMEAA_ENGINEERING_PILLARS_MASTER.md` **404 على main**، وإحالته ليست موجودة في مقدمة AGENTS المفحوصة.
- توجد بالفعل `docs/ENGINEERING_COMPLETENESS_CHECKLIST_AR.md` وفيها **16 بابًا** تشمل المعمار، قاعدة البيانات، الأداء، الأمن، الخصوصية، موثوقية التشغيل، الاستعادة، الرصد، الواجهة، الاختبارات، Realtime، AI، الدفع، الموارد، تجربة التطوير، والنشر.
- ليست كل مربعات Checklist المفرغة دليل غياب الكود؛ يجب التمييز بين `IMPLEMENTED_UNVERIFIED`, `VERIFIED`, `MISSING`, `BLOCKED`, `NOT_APPLICABLE` مع رابط اختبار.

**العمل:** اكتشف هل الملف موجود محليًا وغير متتبع أو على فرع؛ قارنه بالمرجع الموجود، لا تنشئ دستورًا منافسًا. ارفع PR صغيرًا لإحالة مصدر واحد وخريطة تغطية بين المتطلبات → tests → CI → owner. واصف “28” غير ملزم إذا التعداد الفعلي مختلف.

### P0-D — الأمن: ثغرات أدوات الفحص وأعمال مراجعة حقيقية

- `.github/workflows/backend.yml` يحتوي gofmt, go vet, go test, sqlc، ولا يحتوي `govulncheck`.
- `.github/workflows/frontend.yml` يثبت npm بواسطة `npm install --no-audit --no-fund` ولا تظهر خطوة `npm audit` بديلة في هذا الملف.
- **لا نستنتج أن التبعيات مصابة بالفعل؛ فقط أنه لا يوجد فحص معلن ضمن هذين Workflow.** أضف فحصًا مدروسًا مع سياسات استثناء ومراجعة للمخرجات؛ لا تكسر تسليم المنتج بتحديثات غير آمنة بالجملة.
- تحقّق من rate limits لــ signup/reset/OTP/login والحدود على IP/identity/action مع `Redis` عند تعدد instances، ومن أي `X-Forwarded-For` غير موثوق مع `middleware.RealIP`.
- اختبر cross-school/teacher assignment/parent-child/revoked entitlement وحماية answer keys وidempotency للدفع والتسليم.
- `server.go` يقدم `/health/live` و`/health/ready` مع Ping لــ PostgreSQL وRedis خلال ثانيتين؛ لا تطلب health/deep عامًا بلا صلاحية ولا تجعل تعطل AI غير الأساسي يفشل readiness.
- راجع sanitize للـKaTeX/XSS، CSRF، hooks الدفع، الأسرار، uploads signed URLs، حذف/تصدير البيانات والخصوصية PDPL.

### P1 — الواجهة والتطابق الحقيقي

- المرجع البصري والوظيفي هو **أحدث Legacy/main** وليس mock مختصرًا أو صفحة متماثلة في الاسم.
- أعِد المقارنة بأدوار متماثلة وبيانات متماثلة ومقاسات `390 / 820 / 1440`، مع RTL والخطوط/الألوان/spacing والانتقالات والأخطاء/الفارغ/التحميل/التحديث/الرجوع/حفظ المسودات.
- لا تجعل screenshot component وحده شهادة مطابقة رحلة كاملة أو شهادة DB.
- جرد الرحلات: Public/Auth؛ مدير المنصة path→subject→content→student visibility؛ Student learning→assessment→result→review→remediation؛ Teacher/School/Supervisor/Parent؛ Commerce/AI/Operations.
- لا تعتمد Lighthouse وحده لإثبات A11y؛ اختبارات keyboard/labels/focus/contrast وWCAG 2.2 AA.

### P1 — الأداء والكاش والوسائط

- راقب p50/p95/p99، bytes، query count، N+1، `EXPLAIN ANALYZE`، sizing/LCP/CLS/INP، pagination، ثم حسّن الأجزاء المقاسة.
- Redis cache لا يجوز أن يعبر tenant/role/scope/entitlement؛ يجب TTL + explicit invalidation + tests. لا كاش نتائج فردية أو مفاتيح إجابات تخرق الخصوصية.
- WebP وlazy loading مناسب للصور الملائمة، لكن لا يضيع تفاصيل صور الأسئلة الرياضية أو يغير نسبة الصور.
- `render.yaml` يحدد **Cloudinary لبيئة staging** بينما الـBlueprint يستهدف Cloudflare R2؛ سجّل القرار الحالي ولا تعكسه بصمت.

### P2 — التربية وOperations Research (ليس أول شريحة الآن)

- يوجد adaptive ranker بالفعل في `internal/learning/domain/adaptive_selection.go` وقراءاته في `internal/learning/repository/postgres/adaptive_selection.go`؛ **لا تعِد كتابته**.
- حافظ على مصدر الحقيقة `Assessment/Attempt/Server Scoring/Result/MasteryEvidence` وعلى التمييز بين school membership وentitlement.
- البداية التجريبية للـOptimization: اختيار أسئلة اختبار تحت قيود approved/version/scope/access/no-duplicate مع قياس coverage والعدالة، ثم خطط دراسة بموازنة الوقت والمهارات، ثم جدولة مدرسية إذا توفرت بيانات. Feature flag وfallback وتسجيل قرارات وbenchmark، لا microservice جديدة بلا قياس.
- لا تختلق سياسة "15 سؤال" تشخيصي أو جدول مراجعة 1/3/7 ثابت كشرط عالمي قبل تقييم علمي/منتجي.

## 2) ترتيب التنفيذ **الآن** (ولا تنتقل للشريحة التالية قبل دليل الأولى)

1. **G0-A — تثبيت الحقيقة:** سجّل `git status`, exact legacy/go HEAD, 9 PRs، آخر CI، الملفات المحلية غير المتتبعة خصوصًا Pillars. لا تغيير كود قبل حفظ الحالة.
2. **G0-B — تصنيف فشل الـE2E:** اجمع logs/artifacts وانشر جدول clusters بأصغر 5–10 root causes مثبتة، لا ترسل الـ385 للكاتب كقائمة عشوائية.
3. **G1-A — أصلح أول P0 user journey قابل لإعادة الإنتاج:** ابدأ بــ Auth/modal/navigation وبيئة الـE2E إذا أثبتت أنها سبب مشترك؛ وإلا أصلح أول cluster مثبت من scoped school/student/learning. RED test → smallest code fix → GREEN targeted → full critical smoke → required CI exact-head.
4. **G1-B — توسيع الأمان:** PR منفصل لـscanners ومراجعة rate limiting/negative authorization، لأن مسارات الأمان لا تنتظر إنهاء WebP/Skeletons.
5. **G2+ — باقي الـParity والأداء والميزات التعليمية** بعد استقرار الأساس، وOptimization كقدرة تجريبية لاحقة.

## 3) توزيع التنفيذ حسب الكفاءة لا اسم الأداة

- **Antigravity:** واجهة React، تتبع browser وPlaywright traces، RTL/A11y، مقارنة Legacy وV2، إثبات screenshot وإصلاحات UI المكتملة فقط.
- **Codex:** Go/SQL/assessment/auth/security، اختبارات PostgreSQL معزولة، ترحيلات versioned، الإتقان ومحرك التحسين عند دوره.
- **Herons:** مراجعة مستقلة read-only أولًا، استخراج root causes، negative security review، cross-role test audit، مراجعة PR قبل الدمج.
- **DeepSeek:** التنسيق والمصالحة على GitHub، PR ownership، CI exact-head، منع التداخل والدمج فقط بعد Required Gates.
- **لا وكيل ينشر أو يغيّر الإنتاج** بلا إذن مستقل. لا كاتبين لملف واحد، ولا تعتبر رسالة من الوكيل دليلاً.

## 4) بروتوكول Flash / نموذج منخفض التكلفة

- لا ترسل مشروع 1,600 ملف مرة واحدة لكل مهمة. مرّر لكل وكيل: capability ID + SHA + 2–8 ملفات محددة + اختبار فاشل واحد + عقد المرجع + معيار الخروج.
- اجعل الطلب لوحدة مكتملة (vertical slice)، وأمره أن يتوقف عند UNKNOWN بدلاً من اختراع UI/DB contract.
- استخدم أدوات متخصصة حسب الحاجة: `Playwright trace/screenshots`, `Chrome DevTools`, `go test`, `sqlc`, `EXPLAIN ANALYZE`, `govulncheck`, `npm audit`, `axe`, `Lighthouse`, `k6`, AST/codemods، وإدارة PR. لا تستخدم الأداة لمجرد وجودها.
- بعد كل تغيير، reviewer مستقل يفحص patch والـtests والـSHA ومطابقة Legacy؛ إذا فشل، تعاد نفس الشريحة دون مشروع جانبي.

## 5) شروط إثبات الشريحة في التقرير الأخير

كل تقرير يجب أن يضم:

```text
Capability ID:
Legacy SHA / Go base SHA / Go head SHA:
Issue and reproduction:
Expected Legacy behavior and source:
Actual Go behavior and evidence:
Root cause (not guess):
Files modified (and owner):
Tests RED then GREEN:
Actual backend/PostgreSQL proof vs mocked-only:
Security negative tests:
Visual paired evidence and viewport:
CI run URLs with exact-head conclusion:
PR URL / merge state:
Known limitations/UNKNOWN:
Next exact executable step:
```

**ممنوع** استخدام `DONE`, `PARITY_PROVEN`, `PRODUCTION_READY` دون الأدلة المطلوبة. وإذا فشل اختبار، لا تُعدّل الاختبار ليتجاهل العطل أو ترفع timeout بدون تشخيص. وإذا كان اختبار يتوقع ميزة PROPOSED لا يملكها المنتج الأصلي، لا تختلق تنفيذها؛ صنف الاختبار وسجّل القرار.

## 6) جملة البداية التي ينفّذها Antigravity الآن

> `ابدأ G0-A وG0-B فقط من أحدث main، اقرأ الخطة 03 وAGENTS ووثيقة الفجوات، اجمع CI E2E run 44890325571 مع 3 job logs/artifacts، قسّم 385 failure إلى clusters وأعطني أول Root Cause مثبت وإعادة إنتاجه واختباره RED. لا تغيّر كودًا حتى يتضح السبب، ثم افتح PR واحد لأصغر إصلاح مسموح ضمن ملكية Antigravity. لا تغيّر auth/scoring/database أو production. قدم SHA+PR+tests+screenshots+CI. عند UNKNOWN اذكره.`

**حدود تدقيق هذا المستند:** فحص GitHub وWorkflow Logs وملفات المصدر ووثائق المشروع؛ لم يُنفَّذ اختبار متصفح حي كامل للأصل والجديد، ولا اختبار بيانات Production، ولا فحص فعلي لكل ثغرة، لذا كل بند غير مثبت يبقى `UNKNOWN` أو `REVIEW_REQUIRED`.
