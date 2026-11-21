# سجل المشكلات التي يجب علاجها — نتيجة فحص واقعية لا تخمينات

**مصدر القياس:** GitHub `almeaago` حتى 21-11-2026، وبالأخص https://github.com/nasef6464/almeaago/actions/runs/44890325571. أعد جلب آخر HEAD ورنات CI عند بدء التنفيذ.

## P0-01 E2E غير مستقر والشهادة خضراء جزئية

- تشغيل E2E المفحوص: 606 PASS / **385 FAIL** / 29 SKIPPED.
- تصنيف رسالة الفشل الأولى لكل اختبار من سجلات الشظايا: **312 locator/assertion، 48 timeout، 22 `net::ERR_BLOCKED_BY_CLIENT`، 3 أخرى**. **هذا وصف أعراض وليس 385 سببًا جذريًا**؛ لا تساوِ 312 locator بنقص 312 عنصرًا في المنتج.
- أعلى الملفات فشلًا: `track4_enterprise_ai_system.spec.ts` (95)، `track3_hybrid_access_interactive_video.spec.ts` (67)، `track2_schools_contracts_modules.spec.ts` (48)، `enterprise_b2b_journeys.spec.ts` (24)، `track1_schools_acquisition.spec.ts` (17). أول ثلاثة = **210 فشلًا**. لا تنفذ "ميزات Track" دون عقد أصل/Blueprint؛ صنف `PROPOSED_ONLY` لو ثبت عدم اعتمادها.
- حالات مؤكدة في السجل: `admin-and-learning-spaces-complete.spec.ts:309` لا يجد نص «علاقة الجزء بالكل والسببية»؛ `auth-single-dialog.spec.ts` يفشل `page.goto('/login')` برسالة `ERR_BLOCKED_BY_CLIENT`؛ `organizations-school-report-parity-retry.spec.ts:56` لا يصل إلى زر «اختبارات المدرسة»؛ `student-report-scope-failure.spec.ts:82` لا يجد «اختبار القدرات»؛ `strict mode violation` لزر «تقرير الأسبوع» المتكرر.
- تكررت رسائل Vite proxy `ECONNREFUSED 127.0.0.1:8080`، بينما `apps/web/playwright.config.ts` يبدأ Vite وحده على 5173، ولا يضمن API. **السبب التفصيلي غير مثبت**: بعض tests تعتمد mocks والاتصال قد يكون ضجيجًا، لذلك أثبت علاقة كل اتصال بفشل محدد قبل إصلاح البيئة.
- المخرج المطلوب: تجميع Root Causes مع traces/screenshots/network، ووضع فرضية يمكن اختبارها، ثم إصلاح **أول cluster فعلي مؤثر في رحلة P0**. استعد بعده باقي المجموعات حسب الأثر لا العدد.

## P0-02 فتح/دمج PRs والتوثيق الآلي غير متصالح

- `main` المفحوص: `df538daa98e6615ed5c5d3265c9ab53ddd1cc35b`، بعد دمج #278. نجح Frontend CI وDatabase CI على هذا الرأس في نتائج الفحص. **ليس لدينا إثبات أن Backend وFull E2E اجتازا كل بواباته على هذا الرأس**.
- #278 دُمج ثم انتهى E2E الخاص برأس فرعه بفشل؛ **لا نستنتج تجاوزًا متعمدًا**. افحص Required Checks والقواعد الفعلية والتوقيت وسبب عدم المنع. لا تجعل لون check منفرد يخفي فشل suite أخرى.
- توجد 9 PRs مفتوحة في لقطة الفحص: #274، #273، #271، #269، #268، #266، #265، #264، #262. **أعد الجرد قبل الإجراء**. #274 يستهدف فرع #273 وليس main. #276 دُمج وجمع أعمال Codex/Antigravity؛ فروع قديمة متباعدة ومنفذة جزئيًا، لا تعِد دمجها عميانيًا.
- يتطلب كل PR تصنيف `ALREADY_IN_MAIN`, `STILL_NEEDED`, `PARTIALLY_SUPERSEDED`, `CONFLICT`, `UNKNOWN` مع diff محدد واختبار أثره؛ لا تُغلق أو تدمج دون دليل.

## P0-03 وثيقة المحاور غير موجودة على main — والمرجع موجود أصلًا

- `docs/ALMEAA_ENGINEERING_PILLARS_MASTER.md` أعاد 404 على main؛ النص المقروء من `AGENTS.md` **لا يحيل إليها في المقدمة**. قد تكون موجودة محليًا؛ لا تتهم الوكيل بالفشل قبل فحص local/untracked/branches.
- `docs/ENGINEERING_COMPLETENESS_CHECKLIST_AR.md` موجود فعلًا وفيه 16 بابًا من المعمار إلى Production Gate. **الخانات غير المحددة ليست دليلاً على أن الكود مفقود**؛ تحقق لكل بند من الكود/اختبار/CI.
- التنفيذ: reconcile مصدر واحد، mapping لكل محور إلى كود + test + CI + owner؛ إلحاق قواعد مناسبة إلى AGENTS بعد مراجعة، لا حذف القواعد القديمة ولا تعهد آلي كاذب بأن مجرد قراءة التعليمات يمنع النسيان.

## P0-04 فجوة Security Scanning معلومة، لا «ثغرات مثبتة»

- `.github/workflows/backend.yml` يحتوي Go vet/test/gofmt/sqlc، ولم يظهر فيه `govulncheck`.
- `.github/workflows/frontend.yml` و`frontend-e2e.yml` يشغلان `npm install --no-audit --no-fund`، ولم يظهر فحص npm audit بديل في هذين المسارين. لا يعني ذلك وجود CVEs مؤكدة.
- مطلوب إضافة فحص تبعيات في CI وفق سياسة منظمة، ومعالجة findings حسب الأثر والاستغلال، لا ترقية كل التبعيات عشوائيًا.
- مراجعات مطلوبة وليست مثبتة كغياب: rate limiting لإرسال OTP/Recovery/Signup مع IP/identity/action وproxy trust؛ CSRF/KaTeX-XSS؛ عزل المدارس/الأوصياء/المدرسين؛ تسرب مفاتيح الإجابة؛ الإتاحة والاستحقاقات؛ idempotency للدفع والاختبارات؛ secrets/PII، PDPL.

## P0-05 الـHealth/التشغيل معروفان جزئيًا

- يوجد `/health/live` و`/health/ready` في `internal/platform/httpserver/server.go`؛ readiness يعمل Ping لـPostgreSQL وRedis بمهلة ثانيتين. لا تدّع غيابه.
- مستهدف تشخيص اختياري للمزودين الخارجيين، وليس جعل تعطل AI اختياري يحجب الاستعداد العام. افحص تحمّل فقد Redis حسب الاعتماد الفعلي؛ لا تغيّر semantics بصمت.
- تحقق من graceful shutdown في code/run وليس من عنوان تقرير فقط؛ عرّف metrics/traces/alerts/backups/restore drills وحفظ سلوك الفشل.

## P1-06 فروق الواجهة والـLegacy غير معتمدة بالكامل

- `AGENTS.md` يحظر إعادة التصميم، ويطالب بصور فعلية للأصل والهدف لكل دور ونطاق؛ `docs/CURRENT_STATE.md` يسجل شرائح VERIFIED/TESTED لكن لا يثبت اكتمال المنصة كلها. لا تعطِ نسبة parity صورية.
- افحص public/header/auth والرحلات الإدارية `path → subject → content → student`، والتعلم والاختبارات والنتائج، وبقية الأدوار، والمقاسات الثلاثة، حالات التنقل والحفظ والخطأ.
- `docs/migration/19_LEGACY_UI_100_PARITY_MASTER_PLAN_AR.md` **ظهر في قائمة ملفات main وقت الفحص** رغم أن نص الخطة القديمة يقول إنه غير موجود؛ هذا دليل على تقادم سرد الوثيقة، لا دليل تفعيل خطة ثانية. افحص محتواه وتاريخه وصلاحيته كمرجع تابع قبل الاستعمال.

## P1-07 الأداء والكاش والوسائط

- يوجد Skeleton component وRedis cache infrastructure واختيار adaptive حقيقي؛ لا تدّع غيابها أو تعمّم استخدامها بدون مقياس.
- قِس N+1، query count، p50/p95/p99، cache hit، CLS/LCP/INP، حجم الحزم والصور. لا تُخفِ التأخير بـSkeleton فقط.
- Redis scoped by tenant+role+entitlement مع invalidation؛ فشل الصلاحيات ممنوع بسبب مفتاح cache مشترك.
- `render.yaml` يحدد Cloudinary staging، بينما وثيقة القرار المعماري تهدف إلى Cloudflare R2؛ سجّل الاختلاف كقرار بيئة ولا تغيّره صامتًا.

## P2-08 بحوث العمليات ليست نظامًا قائمًا كاملًا

- يوجد ترتيب تكيفي فعلي `internal/learning/domain/adaptive_selection.go` وPostgreSQL query في `internal/learning/repository/postgres/adaptive_selection.go`؛ لا تستبدله في P0.
- OR لاحقًا لتكوين اختبارات تحت قيود، ثم توزيع وقت الدراسة والمراجعات، ثم الجداول المدرسية؛ كلها تجربة خلف Feature Flag بعد صحة صلاحيات الأسئلة والنسخ والإتقان وإثبات عدم تسرب المحتوى.
- أي سياسة عدد أسئلة Placement أو فواصل مراجعة لا تصبح سياسة منتج دون اعتماد وتجربة وتقييم تربوي.

## ما لم يتم إثباته

- لا قياس أداء إنتاج حي، ولا جرد كل الثغرات، ولا مقارنة حية شاملة لكل الأدوار بين Legacy/Go ضمن هذه المراجعة.
- لا حالة نشر Render أو Neon مؤكدة من هذه الوثيقة؛ `render.yaml` ليس دليل نشر.
- لا دخول إلى تعديلات Antigravity المحلية غير المرفوعة أو أسرار مزوديه؛ يلزم فحص الجهاز الفعلي.
