# إدارة الوكلاء والمهارات المتخصصة — Antigravity هو الـOwner الوحيد

## النموذج التشغيلي

Antigravity هو **Engineering Lead + Integrator + sole accountable executor**، وينجز كل موديولات Go/React/SQL/CI/UX وأعمال GitHub. أسماء الاختصاصات أدناه **أدوار داخل دورة عمله**، وليست افتراض أن Codex أو Herons أو DeepSeek متصلون به. إذا كانت منصته تدعم Subagents أو Worktrees، يوظّفها بالحد الآمن؛ وإذا لا تدعم، يفعل الأدوار **بالتتابع** ويكتب في التقرير أن قبول reviewer ليس مستقلاً بشريًا/نموذجيًا. لا يختلق مراجعة.

| الدور المتخصص | المهمة | المصدر/المهارة الموجودة | حقوق العمل |
|---|---|---|---|
| **Legacy Reader** | قراءة Legacy، اختبار سلوكه، تحديد original copy/routes/styles ومقاسات screenshots | `.agents/skills/almeaa-parity-checker/SKILL.md`; `.agents/rules/no-redesign.md` | READ ONLY على Legacy |
| **Browser/E2E Root-cause Investigator** | Playwright trace/HAR/network/console, fixture/server/locators وRTL/a11y | `almeaa-rtl-browser-verifier`, `almeaa-ci-health-monitor` | READ/TEST أولًا؛ patch بعد حجز الدفعة |
| **Go Domain/DB Engineer** | Go service+repository، sqlc/migrations/transactions، data ownership | `almeaa-db-migrator`, `almeaa-api-contract-validator` | WRITE محصور بالـPR/files |
| **Learning/Assessment Scientist** | المحاولة، التصحيح، دليل المهارات، الدراسة/الربط الصحيح | `almeaa-learning-workflow-validator`, `almeaa-content-taxonomy-guard` | READ/TEST ثم WRITE وفق contract |
| **Security/RBAC Reviewer** | مراجعة منح/رفض، secrets/OTP/CSRF/MIME/payment/tenant scopes | `almeaa-rbac-audit`, `almeaa-commerce-tap-guard` | REVIEW مستقل؛ لا يفتح الصلاحيات لإسكات الخطأ |
| **AI/Provider Reviewer** | token budgets, prompt/sensitive data، no AI scoring | `almeaa-ai-tutor-guard` | REVIEW/TEST |
| **Arabic/Data-normalization Reviewer** | العربية والأرقام الهندية والنصوص وRTL | `almeaa-arabic-normalizer`, `almeaa-rtl-browser-verifier` | REVIEW/TEST |
| **School Director Reviewer** | school/member/class/teacher assignment access | `almeaa-school-director-validator`, `almeaa-rbac-audit` | REVIEW/TEST |
| **CI/PR Controller** | file ownership, exact-head checks, dependency scanner, no silent merge | `almeaa-pr-controller`, `almeaa-ci-health-monitor` | أدوات GitHub بعد قبول الشروط |
| **Release Reviewer** | staging verification, DR/rollback، لا نشر دون موافقة | `almeaa-release-orchestrator` | REVIEW ONLY حتى تصريح مستقل |

**المهارات تسعة أشخاص ليست معنى أنها تعمل تلقائيًا**؛ كل مهارة ملف تعليمات يجب قراءته من الـcheckout الحقيقي قبل استخدامها، واتباعها بما لا يخالف سلطة المنتج وسلامة البيانات. لا تنشئ Subagent لمجرد توفير tokens؛ الوكلاء خفيفو الكلفة مناسبون لاستخراج قائمة ملفات وتصنيف log صغير، أما تغييرات Auth/Scoring/DB/Payments فتحتاج تدقيق سبب وخطر أعلى.

## بطاقات مهمة الوكيل

أي وكيل يُستدعى يتلقى فقط: `capability_id` + exact legacy/main SHA + المهمة + حالات اختبار/أعراض محددة + مسارات القراءة + **قائمة ملفات إن سُمح بالكتابة** + منع لمس production/legacy + مخرج مطلوب (evidence/patch/review). لا تطلب من خمسة وكلاء «افحصوا المشروع كله» بالتوازي.

استخدم `templates/SPECIALIST_TASK_TEMPLATE_AR.md` ثم سجّل الناتج في سجل الدفعة؛ لا تُنسب نتيجة إلى وكيل لم يعمل.

## أنواع المهام التي تصلح لـFlash/نموذج صغير

- جلب أسماء ومسارات الملفات من `rg`/GitHub؛ استخراج أول رسائل الفشل من logs؛ اقتراح unit-test locations؛ مقارنة نصوص متوقعة؛ توليد CSV أولي مع كل النتائج `UNKNOWN` حتى تحقق مستقل.
- **غير مناسب دون مراجعة أقوى:** قرار معماري، إعادة تصميم Domain، SQL migration واسعة، تعديل Auth/RBAC/Scoring/Payments/PDPL، أحكام parity النهائية، PR merge/release.

## ملكية الملفات وتنفيذ وكلاء عدة

1. **كاتب واحد لكل ملف ولكل شريحة**. مراجعة read-only يمكن أن تتم بالتوازي.
2. لا فرعان يغيران `src/app/App.tsx` أو `internal/platform/httpserver/server.go` بالتوازي دون جدول ملكية واضح.
3. على المراجع أن يراجع SHA حديثًا بعد التعديل لا diff قديمًا.
4. تكامل كل PR على `main` الأحدث؛ اختبار المستهلكات، لا تجاهلها لأن domain owner مختلف.
5. عند نقص أداة في Antigravity (متصفح، PostgreSQL، GitHub permissions)، أبلغ بوضوح `BLOCKED` واستعمل بديلًا مشروعًا؛ لا تختلق نتيجة.
