# ALMEAA — مراجعة الواقع وخطة التطوير الهندسي الموحدة

**تاريخ الفحص:** 21 نوفمبر 2026. **نوع الوثيقة:** خطة تنفيذ مقترحة + نتائج فحص read-only؛ ليست شهادة إطلاق ولا طلبًا بالدمج.  
**مستودع التنفيذ:** https://github.com/nasef6464/almeaago  
**مصدر الأصل للقراءة فقط:** https://github.com/nasef6464/almeaacodax  
**رأس الهدف الذي فُحص:** `df538daa98e6615ed5c5d3265c9ab53ddd1cc35b` (21 نوفمبر 2026).  
**رأس Legacy المفحوص:** `ed28102d7084899856de0371dc2c93a3d602d518` (5 نوفمبر 2026).

## 1. القرار الحاكم

1. الحفاظ على React + Go + PostgreSQL وModular Monolith وعدم بدء Rewrite ثالث. النسخة القديمة مرجع للسلوك والواجهة وليست مصدرًا يُكتب فيه.
2. **استرداد جودة المنصة والتطابق الوظيفي/البصري أولًا**؛ حماية البيانات والصلاحيات وموثوقية الاختبارات والـCI من أولويات P0.
3. **بحوث العمليات تُضاف كتحسين تدريجي** فوق أنظمة Assessment/Learning القائمة، دون أن تحل محل التصحيح أو Mastery أو صلاحيات الوصول، مع اختبارات ومقارنة baseline.
4. لا إعلان Green أو Merged أو PROVEN_PARITY إلا بإثبات محدد للـSHA النهائي. لا نشر Production أو تغيير قواعد بيانات حقيقية دون موافقة منفصلة.
5. مستند الخطة التنفيذية الوحيد الحالي يبقى `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md`. هذه الوثيقة اقتراح تحديث وملحق تدقيق، ولا تصبح منافسًا لخطة 03.

## 2. نتائج مثبتة في GitHub (وليست افتراضات)

| الجانب | الدليل | النتيجة/التقييد |
|---|---|---|
| المشروع الجديد | `cmd/`, `internal/`, `migrations/`, `apps/web`, `.github/workflows` | توجد بنية Go وReact واختبارات فعلية. لا حاجة لإعادة البناء من الصفر. |
| الدمج الحديث | PR #276 https://github.com/nasef6464/almeaago/pull/276 | ضمَّ أعمال Codex وAntigravity مع مصالحة تعارضات؛ لا يعادل قبول كل الوظائف. |
| آخر رئيسي | https://github.com/nasef6464/almeaago/commit/df538daa98e6615ed5c5d3265c9ab53ddd1cc35b | دمج إصلاح بصري متصل بـ820px. |
| Frontend وDatabase CI | https://github.com/nasef6464/almeaago/actions/runs/44890365381 و https://github.com/nasef6464/almeaago/actions/runs/44890395485 | نجحا على SHA الأخير. |
| E2E الحديث | https://github.com/nasef6464/almeaago/actions/runs/44890325571 | 606 PASS، 385 FAIL، 29 SKIP عبر 3 shards؛ هذا **ليس** عدد العيوب المستقلة. |
| أمثلة فشل E2E | سجلات Jobs لذلك التشغيل | عنصر أساس في مساحة التعلم مفقود من منظور الاختبار؛ اختبار Login حُجب بـERR_BLOCKED_BY_CLIENT؛ زر تقارير المدرسة غير موجود في موضعه المتوقع؛ تقرير الطالب لا يعرض العنصر المتوقع. توجد كذلك اتصالات API مرفوضة في بيئة الاختبار. تشخيص السبب الجذري مطلوب. |
| وثيقة Antigravity الجديدة | `docs/ALMEAA_ENGINEERING_PILLARS_MASTER.md` | 404 على main المفحوص؛ لم تظهر إحالة لها في `AGENTS.md` الحالي. قد تكون محلية أو على فرع آخر: **غير مثبتة على main**. |
| وثيقة قائمة بالفعل | `docs/ENGINEERING_COMPLETENESS_CHECKLIST_AR.md` | تشمل 16 بابًا: المعمار، DB، الأداء، الأمن، الخصوصية، الاعتمادية، التعافي، الرصد، الواجهة، الاختبارات، الفصل الذكي، AI، التجارة، التكلفة، تجربة المطور، بوابة الإطلاق. البنود غير المؤشرة ليست دليل غياب الكود. |
| Backend CI | `.github/workflows/backend.yml` | gofmt/vet/test/sqlc، لكن ليس فيه govulncheck. |
| Frontend CI | `.github/workflows/frontend.yml` | `npm install --no-audit --no-fund` بلا فحص npm vulnerabilities منفصل ظاهر في هذا workflow. |
| الصحة وCORS | `internal/platform/httpserver/server.go` | `/health/live` و`/health/ready` حاضران؛ ready يتحقق من PostgreSQL/Redis خلال 2s. قائمة CORS محددة؛ الرفض 403 ظاهر لطلبات OPTIONS غير المسموح بها، لا لكل طلب عابر. |
| تعلم تكيفي فعلي | `internal/learning/domain/adaptive_selection.go` | RankAdaptiveProgress يرتب المهارات بحسب mastery/status/trend/evidence/recency؛ لا تعِد تنفيذه بصورة مكررة. |
| مرجع مدروس | `docs/migration/25_ADAPTIVE_SELECTION_DELIVERY_AR.md` | سياسة التوصية موجودة بالفعل؛ تأكيدها بقياسات حقيقية قبل توسيعها مطلوب. |
| وسائط staging | `render.yaml` | يضع Cloudinary مزودًا في Staging ويصرح بأن R2 خيار fallback، بينما blueprint يستهدف R2. يلزم توثيق سياسة البيئة والتكلفة، لا تبديلها بصمت. |
| PRs غير محسومة | #271 و#273 و#274 | مفتوحة ومتفرعة عن رؤوس مختلفة؛ مقارنات GitHub مع main أظهرت تباعدًا، لذا لا تدمج بالجملة. استخرج delta مفيدة فقط. |
| تحقق من النشر الحي | — | **غير مثبت**. فحص المستودع والـCI لا يثبت حالة Render/Vercel أو التماثل بين واجهتي Legacy وGo في المتصفح عند نفس البيانات. |

**ملاحظة حوكمة:** PR #278 دُمج تقريبًا الساعة 09:36 UTC، بينما التشغيل E2E الخاص برأس الفرع انتهى بالفشل قرابة 09:57 UTC. يجب التحقق من required checks وقواعد الدمج؛ لا ينبغي أن يعدّ فحص لاحق فاشل دليلًا لاعتماد سابق.

## 3. تفسير المحاور المرسلة من Antigravity

- المصطلح «28 محورًا» لا يطابق تعداد العناصر المرسلة حرفيًا؛ لا تعتمد رقمًا تسويقيًا، بل سجلًا مرقمًا ثابتًا بمعايير قبول لكل مطلب.
- أعطِ الأمن والخصوصية والتقييمات والـE2E أولوية أعلى من تحويل كل JPG أو إضافة skeleton لكل صفحة.
- استخدام Redis يكون **قياسيًا ومحددًا**: بيانات عامة أو غير حساسة، مفاتيح مع `tenant/scope/role/entitlement/version` حيث يلزم، TTL، إبطال تلقائي، وعدم تخزين إجابات الامتحان المكشوفة.
- لا تجعل Cloudinary/R2/AI/Payment مزودات خارجية شرطًا لنجاح `/health/ready` إلا إن كانت حيوية لكل وظائف المنصة. أنشئ diagnostic داخليًا محميًا لمراقبة الاعتماديات وقواعد degraded mode.
- استخدم `WCAG 2.2 AA` بدل درجة Lighthouse فقط؛ اختبر لوحة المفاتيح وقارئات الشاشة وخط تجوّل وRTL. لا تستهدف «صفر CLS» كشعار؛ استهدف قياس Core Web Vitals وتحسنًا مثبتًا من baseline.
- Spaced repetition: سياسات قابلة للضبط والاختبار وليست بالضرورة 1،3،7 لكل الطلاب؛ وPlacement diagnostic عدد أسئلته يتبع coverage والدقة والثبات، وليس شرط 15 دائمًا.
- PDPL: جرد البيانات الشخصية والأساس النظامي وأذونات ولي الأمر والاحتفاظ والحذف والتصدير ومزودي المعالجة والتدقيق، بمراجعة مختص امتثال.

## 4. تنفيذ موحد بالبوابات (الترتيب هو أولوية وليس وعدًا زمنيًا)

### Gate 0 — استعادة الحقيقة التشغيلية ومنع تضارب الوكلاء (P0)

**المهام:** تثبيت SHAs لـLegacy/Go، جرد PRs المفتوحة ومحتوياتها مع current main، مصالحة #271/#273/#274، التحقق من أحدث نتائج كل الـCI، نقل وثيقة Antigravity من جهازه إلى PR بعد مراجعتها ومقارنتها بالـChecklist القائمة، تحديث `AGENTS.md` بمصدر واحد للحقيقة، وتوحيد سجل الفجوات.

**المخرج:** ملف `docs/migration/EXECUTION_LEDGER.json` أو تحديث سجل الفجوات الحالي (يُفضَّل إعادة استخدام الموجود) مع capability_id, owner, legacy_sha, go_sha, evidence, blockers, risk, next_action. وحالة واضحة لكل PR قديم: merged/superseded/rebase-required/gap.

**القبول:** لا PR مجهول المصير، لا عملان يكتبان نفس الملف، لا تعليمات وكلاء متعارضة، والـCI المطلوب على exact head. لا تغيير في Production.

### Gate 1 — إصلاح الـE2E الأساسي وجودة الرحلات (P0)

**المهام:** تجميع 385 فشلًا حسب السبب الجذري قبل إصلاحها؛ فصل اختبار البيئة/الموارد/البيانات عن فجوات المنتج؛ معالجة Auth/session/nav، scoped reports، LearningSpace، SchoolDirector والـAPI proxy. تقسيم اختبارات Pull Requests إلى smoke حرجة ومحددة تُشغّل حتمًا، ومجموعة موسعة Nightly/Release عند ملاءمة التكلفة.

**القبول:** جميع اختبارات Golden Journeys الحرجة ناجحة على HEAD (backend واقعي + PostgreSQL منفصل)، مع Negative RBAC، وبدون تعطيل Assertions أو تجاهل فشل الاختبارات. توثيق سبب كل فشل متبقٍ بمالك وتاريخ ودرجة خطورة.

### Gate 2 — الأمان والخصوصية والموثوقية (P0–P1)

**المهام:**
1. `govulncheck ./...` و`npm audit --audit-level=high` أو سياسة مكافئة CI مع سياسات استثناء موثقة؛ تحديث التبعيات بتحكم في الانحدارات.
2. Threat model مسارات signup/login/OTP/reset/purchase/public assessments مع limiting موزع على IP **موثوق من proxy** + حساب/هوية + ميزانية إرسال + حماية التجريب؛ تحقق من ضبط `RealIP` على trust boundary.
3. مصفوفة RBAC tenant/teacher assignment/parent-child/entitlement، واختبارات نفي cross-school/cross-student/revocation وفحص تسرب answer keys.
4. مراجعة CSRF/XSS/KaTeX sanitization، الملفات الموقعة، provider callbacks، idempotent payments/submits.
5. Health dependencies diagnostics غير حاجبة لخدمة التعليم، alerting، graceful shutdown/worker drains، backup+restore drill، وسياسات PDPL للأطفال/الأوصياء.

**القبول:** لا ثغرة معروفة عالية غير معالجَة دون قرار استثناء قابل للمراجعة؛ كل مسار حساس guarded+tested؛ restore drill منجَز في بيئة معزولة؛ privacy matrix معتمد.

### Gate 3 — التطابق الوظيفي والبصري، لا مجرد شكل (P0–P1)

**المهام:** خريطة كل Actor → Screen → Action → HTTP → Go Service → PostgreSQL → Side effects → Reporting + حالات success/loading/empty/error/offline. مقارنة Legacy/Go على بيانات ودور وviewport متطابق (390/820/1440، وبالمقاسات المهمة إضافيًا). الأصناف: Public/Auth، Student/Learning/Assessment، Platform Admin، Teacher/Trainer، Director/School، Supervisor، Parent، Commerce/AI/Operations.

**القبول:** لكل فعل أساسي visual screenshots paired + E2E فعل/حفظ/عودة/Reload + 403/404 والحالات الفارغة + responsive RTL. الحالات: `UNKNOWN`, `PARTIAL`, `BLOCKED`, `PARITY_PROVEN`, `INTENTIONALLY_CHANGED`. لا نسب إغلاق بلا مقام ومقارنة صريحة.

### Gate 4 — الأداء وتكلفة السعة (P1)

**المهام:** تتبع p50/p95/p99، DB queries/bytes/connection pools، اختيار أهم 10 endpoints بحسب الحمل، EXPLAIN ANALYZE، إصلاح N+1، keyset pagination حيث يلزم، CDN وpre-sized images وWebP للوسائط المناسبة، قياس CLS/LCP/INP، وإبطال Redis cache بأحداث نشر أو تغير صلاحيات؛ ضبط bundles/routing/code splitting ببيانات.

**القبول:** baseline وbefore/after وفحص عدم تغيير صلاحيات أو النتائج. لا فرض أرقام latency أو cache hit خارج بيانات load الفعلية.

### Gate 5 — منظومة تربوية موثوقة (P1–P2)

**المهام:** تثبيت Assessment→Attempt→Answer→Server scoring→Result→Skill evidence→Review→Next action. تدقيق mastery/progress charts، التشخيص الأولي، spaced repetition، تصنيف الأسئلة بحسب القدرات التعليمية (Bloom مع مراجعة بشرية)، شرح الخطوات بعد الخطأ، اختبار recency والتكرار والتقدم الصحيح.

**القبول:** لا Mastery مصدره الذكاء الاصطناعي؛ لا تكرار للـevidence عند retry؛ لا محتوى غير منشور/غير مستحق؛ اختبار end-to-end من التشخيص حتى إعادة القياس والظهور في تقارير الطالب/ولي الأمر/المدرسة.

### Gate 6 — Operations Research / Optimization (P2، بنهج تجريبي)

**الترتيب المقترح:**
1. **تكوين الاختبار المقيد:** يحدد المستخدم الـpath/subject والمهارات والأوزان والصعوبة والمدة والعدد؛ hard constraints = Approved+Entitled+Correct tenant+No duplicate+Valid version+No answer leak؛ soft objectives = coverage/balance/exposure/fairness. الاختبار النهائي نسخة immutable، وصاحب التصحيح يبقى Assessment. قارن الحل بأداة التجميع الموجودة؛ fallback deterministic عند عدم وجود حل.
2. **جدولة الدراسة الفردية:** مدخلات `MasteryEvidence`، الوقت المتاح، prerequisites، المحتوى المنشور والـentitlement، عبء الطالب، ومراجعات مستحقة؛ الأهداف زيادة coverage المتوقع مقابل الوقت، مع عدم ضمان تحسن الطلاب من مجرد الحل الرياضي. اعرض سبب التوصية وأسمح بتعديلها؛ لا تتلاعب بالدرجة.
3. **المدارس:** فقط بعد بيانات وجدولة تشغيلية حقيقية: توافر المعلمين والغرف والأقسام وقيود الحصص؛ تمييز hard/soft، أداة تدخل المعلم قبل الاعتماد.

**المعمار:** أولًا pure Go deterministic optimizer في `internal/learning` أو module `internal/optimization` بواجهات قراءة صريحة. لا ننشئ مصدر حقيقة جديدًا. OR-Tools الرسمي يدعم Python/C++/Java/C# وليس Go؛ عندما يصبح التعقيد مبررًا، جرّب Python worker مع queue وtimeout وbudget وfallback بعد قرار ADR/benchmark. لا service جديدة فقط لأن الاسم متاح.

**التقييم:** feasibility rate، زمن الحل، مدى تغطية المهارات والقيود، استقرار الاختيارات، مقارنة baseline، تجارب A/B بموافقة وعلى بيانات آمنة، نسبة override من المدرسين، أثر تعلم مقاس بعد مدة. سجل optimizer version/input constraints/decision trace من دون كشف بيانات زائدة.

### Gate 7 — اعتماد وإطلاق مستقل (P2)

**المهام:** Staging مطابق، اختبار الحمل والأمان، Sentry/traces/alerts، تفعيل النسخ الاحتياطي واستعادة مثبتة، runbook rollback، مراجعة PDPL والبيانات ووسائط Cloudinary/R2 وتكاليف AI، مراجعة المتصفح لرحلات كل دور، وتجهيز تقرير الانحرافات المعتمدة.

**القبول:** قرار release منفصل على SHA نشر محدد، وسجل risk/rollback، بلا blockers حرجة. النشر أو تشغيل migration على بيانات إنتاجية ليس جزءًا من هذه الخطة وحدها.

## 5. تقسيم الأدوار بين الوكلاء الأربعة

| المنفذ | الملكية الأساسية | الممنوع/المراجعة |
|---|---|---|
| **Codex** | أصل منطق المنتج Go/PostgreSQL، تقييم الاختبارات/المهارات، الاختبارات التكاملية، تحسين OR خلف feature flag | لا تعديلات UI مناقضة للأصل؛ لا تعديل بيانات حقيقية ولا دمج دون review |
| **Antigravity** | React/UI/RTL/A11y/Loading/Empty/Error، صور متقابلة، جرد الصفحة والتفاعل؛ رفع وثيقة Pillars كـPR | لا ينشئ دومينًا موازيًا ولا يغير صلاحيات/score من الواجهة |
| **Herons** | Reviewer مستقل: security, CI, performance, adversarial E2E, docs drift، تصنيف السبب الجذري | لا يكتب في ملفات Codex/Antigravity نفسها أثناء التنفيذ؛ يراجع PRs ويدعم أدلة الرفض |
| **DeepSeek** | Integrator/GitHub: reconciles PRs وbranches، exact-head gates، إدارة تضارب الملفات، تحديث ledger والدمج فقط بعد البوابات | لا دمج آلي لفروع متباعدة أو دفع deployment بسبب Build أخضر وحده |

**بروتوكول القفل:** PR واحد لكل capability، كاتب واحد لكل مجموعة ملفات، مراجع مستقل، ولا push إلى `main` مباشرة. لا ينشئ الوكيل Master Plan منافسة أو ينقل SUCCESS من branch إلى main دون CI على الرأس النهائي.

## 6. قالب Definition of Done إلزامي

كل شريحة تقبل فقط إذا أرفق PR:

```yaml
capability_id: STUDENT-LEARNING-XXX
source_repo: nasef6464/almeaacodax
legacy_sha: <exact_sha>
target_repo: nasef6464/almeaago
target_sha: <exact_sha>
actor_role_scope: <who_and_what_scope>
actions_traced: [UI, HTTP, Go, PostgreSQL, external, reporting]
intent: PARITY | INTENTIONALLY_CHANGED
security_tests: PASS | FAIL | BLOCKED
functional_tests: PASS | FAIL | BLOCKED
integration_tests: PASS | FAIL | BLOCKED
visual_evidence: <artifact_url_and_viewports_or_UNKNOWN>
e2e_evidence: <run_url_or_UNKNOWN>
ci_exact_head: <run_urls_and_conclusion>
regressions: []
open_gaps: []
merge_state: OPEN | MERGED | BLOCKED
reviewer: <independent_reviewer>
next_action: <smallest_exact_next_step>
```

**الـPR لا يدمج** إذا أظهر فشلًا في gate مطلوب، أو إذا تعارض مع ملف يملكه وكيل آخر، أو بدون negative security tests عندما يمس صلاحية/دفع/نتيجة. الفشل العام لا يُخفى تحت `SKIPPED`.

## 7. ما الذي يبدأ الآن بالترتيب؟

1. **DeepSeek:** وقف دمج PRs غير المختبرة؛ تفعيل required checks والـstatus ledger؛ إثبات نسخة main/PRs وفصل فشل البيئة عن المنتج. يبدأ بـ #278 و#276 و#271/#273/#274.
2. **Herons:** تحليل logs + screenshot/trace لـ385 فشل وتصنيف root causes، خصوصًا تغيّر التبويبات/التوجيه/404 والسيرفر غير المتاح. يخرج Top 10 clusters وأول فشل قابل للإصلاح، لا مجرد عدد حالات.
3. **Codex:** إصلاح root causes التي تقع في Go/HTTP/DB وnegative security gates؛ تفعيل فحص الثغرات بعد اختبار false positives.
4. **Antigravity:** مقارنة الواجهة القديمة والحديثة على نفس viewport/role/data، واستعادة UX الحقيقي فقط للشرائح المتأثرة؛ مراجعة 28/32 محاور وتوثيق الحالة في checklist الحالية.
5. مراجعة مشتركة ثم فتح PR منفصل لبرهان concept على **constrained assessment assembly** فقط بعد استقرار الـGolden Journeys ذات الصلة.

## 8. ما لم يتم التحقق منه في هذه المراجعة

- لا اختبار متصفح حي متقابل للموقع القديم والجديد ولا فحص screenshot لكل دور؛ لذلك ليس هناك رقم دقيق لنسبة Parity.
- لا تأكيد لحالة نشر Go الحالية على Render أو متغيرات بيئته؛ ملف `render.yaml` وصف بنية لا شهادة نشر. لم تجر أي عمليات على الإنتاج.
- لا قياس أداء/حمولة حقيقي أو جرد كامل للتبعيات والثغرات؛ وصف `govulncheck` مفقود من workflow المفحوص لا يثبت أن المشروع خالٍ أو مليء بالثغرات.
- لا تحقق من وجود وثيقة Antigravity في جهاز Windows المحلي أو الفروع غير المفحوصة بالتفصيل.

## 9. روابط مرجعية

- Contract Blueprint المرفق: `ALMEAA_PRODUCT_BLUEPRINT_V1_AR.pdf`، خاصة صلاحيات الأدوار، رحلة الطالب، Assessment والـParity.
- Architecture Report المرفق: `ALMEAA_Go_Architecture_Report_AR.pdf`، Modular Monolith والتقنيات المعتمدة.
- بوابة الترخيص التعليمي والتقويم: `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md`.
- قائمة هندسية موجودة: https://github.com/nasef6464/almeaago/blob/main/docs/ENGINEERING_COMPLETENESS_CHECKLIST_AR.md
- قواعد الوكلاء الموجودة: https://github.com/nasef6464/almeaago/blob/main/AGENTS.md
- Go govulncheck: https://go.dev/doc/security/vuln/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- OR-Tools supported language docs: https://developers.google.com/optimization/install/
- Saudi PDPL guide: https://dgp.sdaia.gov.sa/

**المبدأ النهائي:** اجعل النتيجة مثبتة في `main` + CI + Browser + DB + Reviewer، لا في رواية الوكيل. وحسّن المنتج بعد صيانة أسس التطابق والثقة، لا بدلًا منها.
