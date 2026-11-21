# ALMEAA — Complete Antigravity Takeover Package

**هدف الحزمة:** إعطاء Antigravity مسؤولية تنفيذ مشروع ALMEAA Go كاملًا، بمنهج Codex المنضبط، اعتمادًا على codebase والمرجع القديم وأدلة الـCI.

## كيفية التسليم

1. **انسخ الأرشيف كاملاً** إلى مكان مخصص للمراجع على جهاز Antigravity، وليس فوق `AGENTS.md` أو كود المشروع مباشرة.
2. أرسل محتوى `START_PROMPT_COPY_PASTE_AR.txt` حرفيًا إلى Antigravity وأرفق ZIP.
3. يجب على الوكيل قراءة `00_START_HERE_AR.md` ثم 01–08 حسب الترتيب، وفحص Git المحلي والبعيد. الـPDF والـMD داخل `references/` مصدر تمهيدي؛ بيانات GitHub الحية أولى بالحكم على الوضع الحالي.
4. **ملحق AGENTS مقترح فقط**؛ لا تستبدل `AGENTS.md` الأصلي. ينفذ PR توثيق صغير بعد المصالحة إذا رأى بنودًا غير مكررة.
5. يقوم الوكيل بالتنفيذ والإصلاح والاختبار في مشروعه المحلي وGitHub، لا داخل هذه الحزمة. الحزمة لا تحتوي مصدر المستودعات أو أي credentials أو database dump.

## المحتويات

- `00_START_HERE_AR.md` — العقد والسلطة ومتى يبدأ.
- `01_REQUIRED_REPO_FILES_AR.md` — قائمة الملفات ومجلدات الكود والاختبارات ومراجع Legacy.
- `02_EXECUTION_METHOD_AR.md` — أسلوب Codex: status → trace → RED → fix → GREEN → reviewer → CI exact head → checkpoint.
- `03_VERIFIED_PROBLEMS_AR.md` — مشكلات مسندة لأدلة وفرقها عن الشكوك.
- `04_PHASES_ACCEPTANCE_AR.md` — مراحل G0–G7 وبواباتها.
- `05_SPECIALIST_SKILLS_AR.md` — الاختصاصات وأسماء SKILL.md الحقيقية.
- `06_PILLARS_AND_OR_AR.md` — المحاور الهندسية وبحوث العمليات.
- `07_LOCAL_COMMANDS_AR.md` — أوامر PowerShell/Go/Playwright/GitHub.
- `08_FIRST_ACTION_NOW_AR.md` — الدفعة التنفيذية الأولى.
- `START_PROMPT_COPY_PASTE_AR.txt` — النص الذي ترسله للوكيل.
- `registers/` — قوالب CSV/JSON لتسجيل المشاكل والبوابات.
- `templates/` — عقد الوكيل المتخصص، PR، ملحق AGENTS المقترح.
- `scripts/readonly_preflight.ps1` — قراءة حالة Git فقط (لا fetch/reset/deploy).
- `references/` — التقرير المعماري، الـProduct Blueprint، والخطتان المرجعيتان اللتان قُدمتا سابقًا.

## لقطات الحالة (لا تنقلها إلى تاريخ اليوم بلا تحقق)

Legacy main `ed28102d7084899856de0371dc2c93a3d602d518` وGo main `df538daa98e6615ed5c5d3265c9ab53ddd1cc35b` عند فحص 21 نوفمبر 2026. آخر تشغيل E2E مفحوص run `44890325571` نتائجه 606 PASS/385 FAIL/29 SKIPPED على رأس فرع إصلاح ثم دمجه؛ لا يمثل Test Green للمشروع كله.

## تنبيه أمان

لا تنفذ هجرات أو رفع بيانات حقيقة ولا نشر تلقائي. ملفات الحزمة للقراءة والتسليم؛ أي تغيير repo يجب عمله في فرع ومراجعة قبل merge، وفي واجهة Legacy لا كتابة على الإطلاق.
