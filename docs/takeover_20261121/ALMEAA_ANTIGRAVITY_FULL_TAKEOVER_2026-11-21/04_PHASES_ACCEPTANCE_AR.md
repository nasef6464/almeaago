# الترتيب التنفيذي وبوابات القبول — مهمة واحدة بعد أخرى

| البوابة | العمل | لا تنتقل قبل |
|---|---|---|
| **G0 — استلام وتثبيت الواقع** | فحص roots/status/PRs/SHAs/CI، حفظ uncommitted work؛ مصالحة Gemini/Codex/DeepSeek والفروع والسجلات؛ تصنيف 385 فشلًا | سجل source/go baseline، branch reconciliation، أول root cause قابل للإثبات؛ لا كود عام أو تغيير نشر |
| **G1 — إصلاح رحلات P0 وE2E** | علاج أصل أسباب الفشل: fixture/CI infra/auth/navigation/learning/reporting/school، ثم tests المرتبطة وGolden Journeys | Targeted RED→GREEN، واجهة وHTTP وGo/PostgreSQL حقيقي عند الحاجة، negative scope، browser evidence وCI exact-head. لا تضليل SKIPPED |
| **G2 — Security/Privacy/Resilience** | govulncheck/npm audits، rate limit، RBAC/tenant/CSRF/OTP/answer-key/idempotency، logs/PII، backup/restore | فحوص أمنية سلبية وتقرير findings ومسؤول، لا CVE خطرة بلا معالجة/استثناء معتمد، backup restore في اختبار معزول |
| **G3 — Parity شامل** | Public/Auth → مدير المسارات/المواد/أثر الطالب → Student/Assessment/Review → Teacher/Director/Supervisor/Parent → Commerce/AI/Realtime/Admin/Reports | تتبع كل زر وحالة وAPI وDB وصور أصل/Go؛ التجارب 390/820/1440 بنفس الدور/البيانات وRTL |
| **G4 — Performance/Accessibility/Operations** | measured N+1, indexes, cache invalidation, images, bundle, a11y, metrics, traces, alerts | before/after measurements + API budgets + security regression + real accessibility journey |
| **G5 — Pedagogy** | مراجعة Placement/Skill Mastery/Review/Spaced repetition/Bloom/feedback | نتائج صحيحة، لا Evidence مكرر، توصية فعلية تقود لتدريب/إعادة قياس، student/parent/school visibility |
| **G6 — Optimization / OR** | POC تكوين اختبار بقيود، ثم خطة مذاكرة، ثم المدرسة بناءً على الحاجة | مقارنة baseline، hard constraints، failure/fallback، privacy، feature flag، نتائج قياس، موافقة محددة على تفعيل |
| **G7 — Release Certification** | security/load/DR/PDPL/soak/rollback، اعتماد جميع الأدوار والـproviders | قرار Release منفصل على deploy SHA، مالك يوافق على النشر، استعادة مثبتة، لا blockers حرجة |

## أول دفعة كود مقترحة

**لا تفترض أن أول root cause هو Auth.** ابدأ بدفعة استكشاف **G0-01**: استخراج traces + تصنيف الفشلات ومنع false claims، مع baseline محمي. بعدها قرّر **G1-01** من الدليل:

- إذا كان إعداد E2E العام يفسّر عدة فشلات (منفذ Go 8080/fixture/browser flags) أصلح البيئة مع اختبارات تحقق من استجابة API وتحميل المتصفح.
- وإلا، أصغر رحلة core مثبتة الفشل (Auth modal أو School Director nav أو Student report scope أو foundation topic) مع TRACE متكامل.
- لا تفتح أربعة فروع إصلاح UI بالتوازي ولا تدمج قبل required exact-head checks.
- إصلاح `govulncheck` و`npm audit` يمكن عمله في **فرع منفصل** بعد تحقق عدم التداخل، ومن دون تحديث جماعي للتبعيات أو إغلاق الفشل بفلتر صامت.

## تقرير كل بوابة

1. عدد القدرات التي تم تدقيقها والـDENOMINATOR الواضح.
2. عدد `VERIFIED`, `PARTIAL`, `BLOCKED`, `UNKNOWN`, `INTENTIONALLY_CHANGED` بالمستند/الدليل لكل سطر.
3. قائمة PRs المدمجة مع SHAs وCI على EXACT HEAD.
4. ما بقي والأسباب واختبارات التراجع المحددة.
5. قرار منطقي: CONTINUE G1 / BLOCKED / READY FOR NEXT GATE؛ لا إعلان «100%» من بناء أخضر.

## قبول Golden Journeys (حد أدنى)

- Guest: landing → header → sign-in/recovery → ما يظهر حسب الصلاحية.
- Platform Admin: path→subject→publish content/questions/assessments→student visible or hidden.
- Learner: enrollment→learning→lesson→assessment attempt/save/reload/submit→server result→skill evidence→review→remediation→report.
- Teacher/Director/Supervisor: delegated school/class/subject membership→assignments→assessments/reports ضمن النطاق.
- Parent: children linked only→readable summaries دون الإجابات الخاصة أو سلطة تغيير الإتقان.
- Commerce: product/package visibility→server-calculated price→checkout→verified grant→revoke/refund/idempotency.
- Realtime/AI: access-bound classroom session and AI assistance with privacy, budgets, failure fallback and no pre-submit answer leakage.
