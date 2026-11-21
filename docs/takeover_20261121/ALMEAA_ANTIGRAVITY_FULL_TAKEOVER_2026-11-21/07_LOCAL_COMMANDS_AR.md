# أوامر التشغيل الآمنة — Antigravity على Windows/GitHub

**مهم:** لا تنفذ أسطر الأوامر دون مراجعة المسار وملكية الملفات والبيئة. لا يُطلب من Antigravity كتابة أسرار في الدردشة أو السجلات. الأوامر أمثلة للعمل داخل checkout صحيح، ولا تنشئ نشرًا أو تغييرًا إنتاجيًا.

## 0) أول فحص — PowerShell من جذر `almeaago`

```powershell
# انتقل أولًا إلى الجذر الحقيقي بعد التأكد منه، لا تفترض ثبات C:\almeaago\almeaago
Get-Location
git rev-parse --show-toplevel
git remote -v
git status --short --branch
git rev-parse HEAD
git branch -vv
git diff --stat
git diff --check

# تحديث مراجع read-only دون checkout أو reset
git fetch origin --prune
git rev-parse origin/main
git log -1 --format='%h %ci %s' HEAD
git log -1 --format='%h %ci %s' origin/main

# ما إذا كان GitHub CLI متاحًا ومتصلًا مسبقًا، دون طباعة token
gh auth status
gh pr list --repo nasef6464/almeaago --state open --limit 100
gh run list --repo nasef6464/almeaago --limit 15
```

**النسخة القديمة:** `git -C 'C:\ALMEAA MAY - codax' ...` فقط بعد التأكد أن هذا المسار موجود، وقد يكون مختلفًا. `git fetch` في Legacy لا يُعد تعديلًا في كود المصدر، لكن لا تقم بأي push/checkout/rebase هناك إذا كان جهاز المالك يعمل عليه.

## 1) الاطلاع على سبب الفشل دون تعديل كود

```powershell
gh run view 44890325571 --repo nasef6464/almeaago --json headSha,status,conclusion,jobs
gh run view 44890325571 --repo nasef6464/almeaago --log-failed
# تنزيل artefacts إلى مجلد مؤقت محلي **بعد فحص محتواها من الأسرار/PII**:
# gh run download 44890325571 --repo nasef6464/almeaago --dir .tmp\antigravity-e2e-20261121
```

- ابدأ بأول سبب مختلف في كل مجموعة؛ لا تقرأ 385 stack trace كأنها 385 bugs.
- اربط اسم test بالنص/selector/route/HTTP/fixture/Go handler. لا تعتمد على خطأ `ECONNREFUSED` وحده كسبب كل الفشلات.
- افتح screenshot وPlaywright trace عن طريق `npx playwright show-trace <path>` بعد التأكد أنها لا تحمل جلسة حساسة.

## 2) البناء واختبار الواجهة محليًا

```powershell
cd apps/web
node --version
npm --version
# لا تستخدم npm install إذا كان lockfile/ node_modules جاريًا استخدامه قبل فحص البيئة
npm run typecheck
npm run build
npx playwright test tests/e2e/auth-single-dialog.spec.ts --workers=1 --reporter=list
npx playwright test tests/e2e/organizations-school-report-parity-retry.spec.ts --workers=1 --reporter=list
npx playwright test tests/e2e/student-report-scope-failure.spec.ts --workers=1 --reporter=list
cd ../..
```

الـ`playwright.config.ts` للمشروع يُشغّل Vite على 5173، و`reuseExistingServer: true`. افحص ما يشغل المنفذ قبل الاختبار؛ CI يُشغّل Vite فقط وليس Go على 8080 في هذا الـworkflow. لا تعتمد نتيجة mocked-browser كدليل تكامل PostgreSQL. عند تكرار `ERR_BLOCKED_BY_CLIENT` راجع browser launch, hooks, proxy/route, controls وتمييزه من رفض التطبيق.

## 3) Go + PostgreSQL

```powershell
go version
go test ./internal/identity/...
go test ./internal/learning/...
go test ./internal/assessment/...
go vet ./...
go test ./...
```

**لا تنفذ migrations أو seed على قاعدة متصلة بproduction أو قاعدة مشتركة.** راجع `docs/migration/owner-handoff/2026-11-01/LOCAL_TOOLCHAIN_AR.md` وتحقق من محرك Postgres المحلي/المنفذ/اسم قاعدة اختبار جديدة وأوامر rollback. اختبارات DB التي skipped لعدم وجود `DATABASE_URL` لا تُعد PASS. لا ترفع ملفات `.env`, trace, logs, database dumps, session files أو upload tokens.

## 4) CI/PR على SHA نهائي

```powershell
gh pr view <PR_NUMBER> --repo nasef6464/almeaago --json number,title,headRefName,baseRefName,isDraft,mergeable,statusCheckRollup
gh pr checks <PR_NUMBER> --repo nasef6464/almeaago
# سجّل exact HEAD:
git rev-parse HEAD
```

- `--no-audit` في CI الحالي ليس عذرًا لعدم الفحص؛ أضف `govulncheck` وNPM audit من خلال PR مدروس بعد قياس نتائجها.
- لا تضغط Merge إذا required check فاشل أو لم يعمل على final SHA. لا تُستخدم أزرار bypass أو admin override.
- لا يشمل هذا التفويض `vercel deploy`, `render deploy`, `psql` على بيانات فعلية، أو أي restart لخدمات المستخدم.

## 5) سكربت ملحق آمن

`./scripts/readonly_preflight.ps1` يجمع Git state فقط ويطبع مخرجات لا تتضمن أسرارًا؛ راجع محتواه قبل تشغيله:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\readonly_preflight.ps1 -RepoPath 'C:\almeaago\almeaago'
```

لا يُحدّث Git أو يمس الملفات. لإعادة جلب أحدث SHA اختر أنت `git fetch origin --prune` بعد فحص ملكية الشجرة.
