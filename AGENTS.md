# ALMEAA Go — Agent execution rules

> [!IMPORTANT]
> **بروتوكول التنفيذ الدائم متعدد الوكلاء (إلزامي لجميع الوكلاء)**:
> يجب على كل وكيل (Antigravity، Codex، DeepSeek، أو أي وكيل آخر) قراءة وتطبيق وثيقة: `docs/engineering/ANTIGRAVITY_EXECUTION_STANDARD_AR.md` قبل البدء في أي مهمة برمجية أو حوكمية.
> لا يُعتبر أي عمل منجزاً إلا بسلسلة أدلة متصلة: العقد الأصلي → الشاشة والـ UI → حمولة الـ HTTP الدقيقة → محلل Go وتطبيقه والصلاحيات → PostgreSQL/قاعدة البيانات → الأثر الدائم بعد التحديث → السيناريوهات السلبية → لقطات الشاشة عبر 390/820/1440 RTL → فحص CI على الـ SHA الدقيق.
> كما يجب الالتزام بـ `docs/ALMEAA_ENGINEERING_PILLARS_MASTER.md` لكافة متطلبات الأداء والأمان والمحاور الهندسية الشاملة (الأداء، الأمان، المراقبة، تجربة المستخدم، البيداغوجيا، الامتثال، قابلية الصيانة، وجودة الإثبات والتسليم).

## عندما يطلب المالك مراعاة الخطة والمحاور والمهارات

عبارة «نفّذ المطلوب مع مراعاة الخطة والمحاور الهندسية واستخدم المهارات» تعني تطبيق الخطوات التالية على المهمة الحالية. يظل المطلوب من المالك هو الذي يحدد نطاق العمل. تعليمات المستودع نفسها تسري على كل مهمة تدخل في نطاقها حتى لو اختصر المالك عبارته.

1. **الخطة والحالة.** اقرأ آخر مدخل مؤرخ في [خطة التنفيذ الوحيدة](docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md)، ثم [نقطة الاستئناف](docs/migration/owner-handoff/2026-11-01/CHECKPOINT_AR.md) وسجل الفجوات والأدلة المرتبطين بها. طابق الحالة مع الفرع المحلي وGitHub وحدد الإجراء المطلوب ومعيار قبوله وملكية الملفات.
2. **المحاور.** راجع [المحاور A–H](docs/ALMEAA_ENGINEERING_PILLARS_MASTER.md) وحدد ما يمسه التغيير من أداء، أمان، تشغيل ومراقبة، تجربة مستخدم، تعلم، امتثال، صيانة وعقود API، وجودة إثبات وتسليم. حوّل كل محور مؤثر إلى تحقق محدد داخل الدفعة.
3. **المهارات.** استخدم [خريطة المهارات في بروتوكول التنفيذ](docs/engineering/ANTIGRAVITY_EXECUTION_STANDARD_AR.md#3-تقسيم-الوكلاء-المختصين--منسق-واحد-وكاتب-واحد-لكل-نطاق). افتح `.agents/skills/<skill>/SKILL.md` لكل مهارة تنطبق، وطبّق خطواتها. مثال تعديل زر حفظ بالعربية: طابق الأصل وRTL في الواجهة، راجع عقد API والصلاحيات، ثم أثبت الحفظ بعد إعادة القراءة. أضف مهارة قواعد البيانات عند تغيير التخزين أو اختبار سلامته.
4. **دليل التسليم.** عند الإنهاء اذكر المحاور المؤثرة، المهارات التي طُبّقت وأثرها، نتيجة الفحوص ورابط الدليل أو SHA، وما بقي والخطوة التالية. راجع [عقد تسليم الدفعات](docs/migration/OWNER_BATCH_DELIVERY_CONTRACT_AR.md) لمعيار الإغلاق.

Read and apply `docs/migration/OWNER_BATCH_DELIVERY_CONTRACT_AR.md` on every direct or scheduled run. A scheduler status/trigger is not a delivered batch or proof of worker liveness. Complete the declared functional slice with evidence, or preserve a precise blocked checkpoint without claiming completion. Full header parity remains PARTIAL/NOT PROVEN until original navigation, role/scope, routes, interactions and paired screenshots pass; identity/hero evidence alone cannot close it.

Read `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md`, `docs/superpowers/specs/2026-10-28-platform-pedagogical-policy-design.md`, and `docs/migration/17_PLATFORM_POLICY_EXECUTION_CHECKPOINT_AR.md` before work. Read the latest source `nasef6464/almeaacodax` main and its `AGENTS.md` and Master Control as the legacy behavior authority; do not assume old snapshots are current.

Treat `nasef6464/almeaago` as the only implementation repository. Preserve existing Go/PostgreSQL modules and React/Vite UI. Work in focused branches and PRs, with tests first and exact-head GitHub CI before merging. Never bypass main protection, silently change auth/RBAC/scoring/payments, write legacy or production data, or cut over MongoDB without a separate verified backup/reconciliation/restore plan.

Deliver actor → screen/action → HTTP → Go domain/application → PostgreSQL/other services trace and label every comparison VERIFIED, PARTIAL, UNKNOWN, or BLOCKED. A route-name match or green unit test is not functional/visual parity. Keep B2C and B2B, subject/path-scoped mastery, school membership vs teaching assignment vs assessment audience vs entitlement, and the unified assessment lifecycle. Validate desktop/tablet/mobile RTL with actual browser evidence; no visual certification without screenshots. Read `docs/migration/19_API_MOUNTS_AND_ASSESSMENT_OWNERSHIP_AR.md` for school assessment ownership work.

At the end of each safe slice: record exact source/target SHAs, tests, CI links, limitations and next action. Do not claim production readiness from isolated tests.

## Binding owner correction — whole-platform UI restoration (2026-10-28)

ALMEAA V2 = original ALMEAA UI/UX/workflows + new backend. Latest approved
`almeaacodax/main` is the binding visual, interaction and functional contract
for EVERY role and page. No silent redesign, new grouping, moved actions,
omitted tabs, generic replacement tables or changed learning workflow.
Reuse source presentation components where possible; adapt APIs to them.
Never write the source repository or production data.

Execution order: comprehensive screen/action/state/role/relation inventory;
paired same-role/data/viewport screenshots; focused complete correction slices.
P0: public site → original admin path/subject workspace with learner visibility →
student/learning/course/player/assessment/results/review → remaining admin. P1: all remaining roles, school, commerce,
settings and operations. Priority is not permission to omit original functions.
Record PARTIAL/MISSING/BLOCKED/UNKNOWN until evidence proves each contract.
Route counts, a build, mocked E2E or green CI alone cannot establish parity.
Acceptance includes all controls, back navigation, retained scope, persistence
on reload, relationships, RBAC, real Go/PostgreSQL integration, responsive RTL
and loading/empty/error/dialog states. Target 100%; never claim it without
paired runtime evidence. Keep completed backend work; no wholesale rebuild.

## Plan reconciliation and path/subject priority (owner report, 2026-10-28)
`docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md` is the only active Go execution plan. Read its reconciliation section and the matrix in26 before new work. Slice specs/plans are subordinate. Preserve public fixes#150/#151 and the current font slice before starting another branch. Complete public dynamic settings/header gaps, then restore original path-card→path-workspace→subject-card→subject-workspace as one usable flow with real learner visibility. Reuse current Go domains. Do not import Legacy0–9 closure statuses, merge stale PRs wholesale, or allow two implementation writers on one branch. Explicit Topic/skill links and no-autostart video/training policy remain binding.

## Independent engineering handoff accepted — 2026-10-28
Read `docs/migration/reviews/ALMEAA_GO_INDEPENDENT_ENGINEERING_HANDOFF_AR_2026-10-28.md`
as an independent review subordinate to plan03, not a second roadmap. Its PR/head
snapshot is historical: #152 is merged at98d5cd519455e0775cf6b868f7c6e388ef4ef739.
Before implementation recover current HEAD/PR/local changes; retain verified work.
Use a Modular Monolith with explicit domain ownership and Vertical Capability
Slices across every consuming role. Do not duplicate assessment/scoring/mastery
or permission decisions in adapters, UI or another module. Infrastructure in
`internal/platform` remains cross-cutting; content presentation stays in content.
Track each screen/control/state through HTTP→service→storage→consumer with
source/head/evidence and UNKNOWN/PARTIAL/BLOCKED until actually proved. See the
current-action register and acceptance checklist in26. MERGED/TESTED is scoped
evidence, never a whole-platform parity certificate. Keep report findings from
code distinct from browser reproductions; preserve source failure/false/empty
semantics and explicit Topic scope. No production writes, deployment or cutover.

## Evidence and handoff

Start with the latest dated resume entry in the active plan and checkpoint. Establish actual branch ownership from the checkout and GitHub before editing. For changed journeys, compare the UI request, OpenAPI, Go routing and DTOs, and storage; distinguish mocked, local real-stack, and exact-head CI evidence. Use the affected ALMEAA skills under `.agents/skills`. Preserve the last reproducible checkpoint across sessions.

## ALMEAA_CODEX_CONTINUATION

Codex owns local engineering execution for the approved Legacy-to-Go migration.
The owner's "أكمل" means resume the current evidenced slice, not restart discovery.
Keep all existing rules above. Start with
`docs/migration/owner-handoff/2026-11-01/CHECKPOINT_AR.md`, then the active item in
`gap-register.json` and its `verification.json` evidence. Check Git status, branch,
exact local/remote heads and current PRs before writing; preserve other writers'
changes. `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md` remains the sole plan.
Read `PRODUCT_LOGIC_CONTRACT_AR.md` and `CAPABILITY_CONTRACT_TEMPLATE_AR.md` in the
same handoff directory for the affected capability only; read `LOCAL_TOOLCHAIN_AR.md`
for reproducible local checks and available tools. One writer per owned file;
use independent reviewers only when useful, not an always-running agent team.
Test locally first, batch related verified changes before push, and inspect
automatic CI/preview triggers without disabling protection. No production data,
cloud settings or deployment actions are authorized by this continuation rule.
Before stopping, update the existing checkpoint with exact code SHA/PR, changed
files, PASS/FAIL/SKIPPED, visual evidence limits, blockers, merge state, the next
action and its first local command. Do not claim unattended continuation unless
a separately authorized scheduler actually exists.
