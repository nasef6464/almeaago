# طريقة تنفيذ Antigravity — استلام Codex إلى إنجاز قابل للإثبات

## A. بداية كل جلسة / بعد كلمة «أكمل»

1. افتح جذر مشروع **المستهدف** الحقيقي في جهاز المستخدم وتأكد بـ`git rev-parse --show-toplevel` و`git remote -v`؛ الجذر المذكور تاريخيًا `C:\almeaago\almeaago` **ليس ضمانًا**. تأكد كذلك من جذر المصدر القديم دون كتابته.
2. اقرأ `AGENTS.md`، `.agents/rules/no-redesign.md`، `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md`، `docs/migration/OWNER_BATCH_DELIVERY_CONTRACT_AR.md`، `docs/migration/owner-handoff/2026-11-01/CHECKPOINT_AR.md`، والسجل الفعلي للدفعة الجارية. اقرأ خطة Gemini الموجودة بصفتها وثيقة داعمة لا خطة ثانية.
3. سجل `git status --short --branch` و`HEAD` المحلي والبعيد و`PRs` والـCI على SHA؛ **لا تستخدم reset/clean/stash/checkout متسرعًا** فوق تعديلات مستخدم أو وكيل. إن وجدت تغييرات غير متتبعة فحدد ملكيتها واحفظها.
4. راجع أحدث `almeaacodax/main` وMaster Control؛ لا تستخدم SHA مرجعي قديم لحكم parity اليوم.
5. استعد أول `capability_id` غير مكتمل من سجل الفجوات الموجود `docs/migration/owner-handoff/2026-11-01/gap-register.json` أو آخر checkpoint؛ لا تبدأ اكتشافًا شاملاً من الصفر كل جلسة.
6. اختر **دفعة رأسية صغيرة ومكتملة** (فاعل/دور → شاشة/إجراء → HTTP → Go Application/Domain → PostgreSQL/مزود → نتيجة/تقرير)، ودوّن قائمة الملفات المحدودة والتبعيات وأثرها على أدوار أخرى.

## B. دورة إصلاح واحدة مضبوطة

1. **Trace:** اختبر في Legacy وGo بنفس الدور/الحالة والبيانات المناظرة، وثبت الملاحظة من source code + browser + network. اكتب المتوقع والفعل والـSHA والمقاس.
2. **Classify:** `ENV_INFRA` أو `FIXTURE` أو `TEST_DRIFT` أو `ACTUAL_REGRESSION` أو `LEGACY_GAP` أو `PROPOSED_ONLY` أو `UNKNOWN`. لا تبدأ بتعديل الواجهة لعلاج `ENV_INFRA`.
3. **RED:** اكتب أو استعمل اختبارًا يُظهر العطل الحقيقي؛ لا تغيّر assertions لإخفائه. عيوب الصفحات تشمل loading/empty/error/retry/refresh/back/direct route والـ403 عند عدم الأهلية.
4. **Smallest safe patch:** عدّل مصدر الحقيقة في domain الصحيح، أو طبقة العرض الأصلية إن كان بصريًا. الأفضل reuse/typed adapter/AST-codemod للتكرار الآمن بعد مراجعة؛ ممنوع blind conversion.
5. **GREEN targeted:** شغّل أقرب unit/contract/integration + browser test لنفس العطل، مع حماية cross-tenant/access/score/payment عند المساس بها.
6. **Regression:** اختبارات المستهلكات المرتبطة + Go tests + TS build، وصور Legacy/Go 390/820/1440 إذا كانت الشريحة مرئية. امسك console/network errors والتنسيق RTL وA11y؛ لا تفترض التطابق من screenshot واحدة.
7. **Review:** أعطِ مراجعًا متخصصًا لم يكتب الشريحة: diff، evidence، test-run، معيار الخروج، وأثر التغيير عبر الوحدات. سجل اعتراضاته؛ لا تسجّل APPROVED باسم مراجع لم ينفذ مراجعة فعلية.
8. **PR/CI:** فرع حديث من main بعد مصالحة الجاري، commit واضح، PR صغير، required checks على **آخر head_sha**. أي FAIL/SKIPPED في بوابة ملزمة = غير مقبول. **لا تنشر**.
9. **Checkpoint:** حدّث السجل الأصلي أو GEMINI_CURRENT_HANDOFF دون فتح سجل رئيسي منافس: SHA، ملف/وظيفة، الأدلة، PASS/FAIL/SKIPPED، الحدود، PR، merge state، الأمر الأول للدفعة التالية.

## C. الفصل بين أنواع الأدلة

- `UNIT`: اختبار وظيفة/Domain ولا يثبت الـDB الحقيقي.
- `MOCK_BROWSER`: واجهة وتفاعل على API محاكى، لا يثبت SQL أو مزودًا خارجيًا.
- `INTEGRATION_DB`: PostgreSQL اختبار معزول حقيقي، لا يثبت عرضًا بصريًا أو بيانات إنتاج.
- `LIVE_E2E_STAGING`: Browser→real Go→isolated PostgreSQL/verified external boundary، مع سجل مطابق.
- `LEGACY_VISUAL_PAIR`: صورتان مع SHA والدور/البيانات/viewport/DPR والخطوط، وليس مكوّنًا واحدًا باسم تطبيق كامل.
- `SECURITY_NEGATIVE`: وصول ممنوع، تغيير نطاق، CSRF/tenant/answer-key/revocation/idempotency.
- `CI_EXACT_HEAD`: التشغيل على SHA النهائي الذي سيُدمج، ونتيجته.
- `PRODUCTION`: لا تنتج هذه الفئة بلا موافقة نشر وفحص حقيقي مستقل.

## D. عند تضارب الوثائق

**ترتيب السلطة:** طلب المالك الأحدث المتوافق مع الأمان > قواعد `AGENTS.md` وLegacy Master Control المعتمدة والخطة 03 > وثيقة capability الحالية > التوثيق التاريخي/الأقدم > رأي الوكيل. لا يمس Antigravity حقائق النتائج/الدفع/الصلاحيات إلا ضمن عقد حاكم مثبت. وثائق Gemini القديمة قد تنص على «Codex reviewer»؛ هذا تغيّر تنظيمي فقط: Antigravity الآن مالك التنفيذ، ومراجع مستقل داخل منصته أو تقرير مراجعة خارجي، وليس إنشاء Codex جديد شرطًا لبدء التنفيذ.

## E. لا تجعل الدفعة عملاً عشوائيًا

- المهمة لا تتجاوز عادة **وظيفة ومستخدميها وعقودها**، وليس 30 صفحة متزامنة.
- عند الانتقال بين الأدوار، اختبر أثر نفس الحقيقة: نشر محتوى المدير يظهر للطالب؛ تخصيص الاختبار يظهر للجمهور المسموح؛ نتائج الطالب تظهر للمصرح فقط في التقارير.
- كل مسار فيه خصوصية أو استحقاق: اختبارات سماح **ورفض** في الخادم، لا واجهة فقط.
- تحفظ الصور مع مخرجات اختبار معروفة، لا تكتبها فوق baselines معتمدة.
- إن تعطل اختبار، لا تستبدل السبب بتخمين؛ سجّل BLOCKED بأدلة ثم انتقل لنطاق مستقل يمكن إنهاؤه.
- يمكن لوكلاء Antigravity المتخصصين القراءة/الفحص بالتوازي، لكن **كاتب واحد لكل ملف/فرع**، والمراجعة المستقلة تحصل بعد استلام patch.

## F. تعريف الإغلاق الحقيقي للمشروع

المشروع كله لا يصبح `PARITY_PROVEN` حتى تثبت المسارات العامة، Admin، Student، Teacher، Trainer، Director، Supervisor، Parent، Commerce، AI، Realtime وOperations، بأفعال المستخدم وحالاتها ونطاقاتها ونتائجها وتكافؤها المرئي/الوظيفي. ثم security/load/backup-restore/staging/rollback والقرار النهائي المستقل. عمل فرع أو اختبار فردي لا يحول المشروع كله إلى VERIFIED.
