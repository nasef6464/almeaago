# التشغيل والتحقق المحلي

لا تُحمّل مكتبة لمجرد توفرها. أدوات البداية موجودة فعلًا: Go1.27.1، Node24.11.1، npm11.6.2، Git وGitHub CLI، PostgreSQL18.6 في `C:\almeaago\pgsql\bin`، Playwright1.63.0 وChromium1243 داخل cache المستخدم. لم يلزم تثبيت إضافات أو تغيير dependencies لهذه الدفعة. Docker غير متاح عبرPATH؛ PostgreSQL المحلي يكفي للعزل. ملفات `.agents/skills/` في المشروع تتضمن أدوات مطابقة وRTL وPR/API؛ تُقرأ المهارة المناسبة للنطاق فقط.

## تحقق بدون خدمات سحابية

من `C:\almeaago\almeaago\apps\web`:

```powershell
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test tests/e2e/question-bank-admin.spec.ts --grep 'authoring answer parity' --reporter=list --workers=1
```

Playwright يشغّل Vite على127.0.0.1:4173 وفق config المشروع. هذه الاختبارات تستبدلHTTP ببيانات صناعية؛ لا تثبتGo/PostgreSQL. لا تستخدم توكنات أو حسابات الإنتاج. عند استخدام اختبارات أوسع راجع مواضعnetwork وseed أولًا. الاستدعاء المباشر لأدواتNode يتجنب أي تنزيل تلقائي منnpm exec.

من جذر الجديد:

```powershell
go test ./internal/questionbank/...
node --test scripts/parity/screen-inventory.test.mjs scripts/parity/route-inventory.test.mjs
node scripts/parity/owner-handoff-snapshot.mjs --legacy 'C:\almeaago\almeaacodax' --output docs/migration/owner-handoff/2026-11-01/discovery.json
```

لـAPI/التخزين الحقيقي: cluster جديد داخل `.tmp/owner-verification-20261101-pg`، على127.0.0.1:55439، وقاعدة `almeaa_owner_verify_20261101`، بمهاجرات المشروع الكاملة. لا تفتح `.env` أو تستخدم `C:\almeaago\pgdata` المشتركة. مصادقةtrust هنا محلية loopback فقط ببيانات صناعية؛ ليست إعداد إنتاج.

تشغيل اختبار التخزين يتطلب `QUESTIONBANK_PERSISTENCE_DB_TEST=1` وDATABASE_URL محليًا صريحًا. الاختبار المتخطى SKIPPED لا يعدPASS. جلسةHTTP صناعية لا تثبتتسجيل الدخول الحقيقي. يسجّل CHECKPOINT أوامر التشغيل والنتائج، بما فيها المهاجراتالفاشلة وأسبابها.

## الأدلة

الأدلة الكبيرة محليًا في `.tmp/` و`apps/web/test-results/`؛ لقطاتالمقارنة المعتمدة تُربط من `docs/migration/evidence/` بعد مراجعتها. لا ترفع بيانات شخصية أو أسرار أو قواعد محلية أو traces لجلساتحقيقية. كل لقطة لها SHA ودور وحالة وبياناتصناعية ومقاس وDPR وخطوط. لقطاتالجديد وحده لا تكفي لإغلاق المطابقة.

لا تعدّل إعداداتRender/Vercel/Neon/Cloudinary ولا تنشرmain ضمن هذا التفويض. افحصCI على الرأس النهائي قبل أي دمج لاحق؛ لا تُخفّض حدودالمقارنة أو تتخطّاختبارًا لفتح بوابة.
