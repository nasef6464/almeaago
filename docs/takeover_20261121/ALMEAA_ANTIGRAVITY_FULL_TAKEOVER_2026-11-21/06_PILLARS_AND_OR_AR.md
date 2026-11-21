# المحاور الهندسية الكاملة — أدلة لا شعارات، وOperations Research في توقيته

## لا تسميها «28 مكتملة» لأن ملفًا موجود

اعتمد **16 قسمًا** قائمة بالفعل في `docs/ENGINEERING_COMPLETENESS_CHECKLIST_AR.md` كمصفوفة رئيسية؛ واربِط بها محاور Antigravity التي أرسلها المالك، بما فيها المحاور التقليدية الستة. قد يكون عدّ «28» في التقرير غير مطابق لكل البنود الجزئية؛ العبرة بنطاق الاختبار لا الرقم. استخدم `registers/PILLAR_EVIDENCE_MATRIX.csv` كبداية `UNKNOWN/UNVERIFIED`، ثم ارفع كل بند إلى `VERIFIED` فقط بمرجع كود واختبار/قياس/CI.

| المجال | الفحص اللازم | Evidence gate |
|---|---|---|
| Architecture | Domain owner, Modular Monolith, no duplicate scoring/entitlement/RBAC | tracing + ADR عند تغيير architecture |
| Database | indexes/constraints, N+1, bounded/keyset pagination, safe migrations, EXPLAIN | SQL/integration/plan/benchmark قبل/بعد |
| Performance (6) | Indexes, N+1, pagination, WebP+responsive images, Redis invalidation, Skeletons | p95/load/query count/CLS screenshots؛ الكاش لا يعبر scope |
| Security | IP+identity+action throttles، strict validation، CSRF/XSS/KaTeX، RBAC/Tenant، secrets، dependencies | tests negative + scanner + remediation decisions |
| Privacy/PDPL | PII map, Saudi retention/legal controls, access/export/delete, age/guardian scope | review/privacy tests/policy approval |
| UX/A11y | keyboard, screen reader labels, contrast WCAG 2.2 AA, RTL, success/empty/error/loading/offline | browser evidence desktop/tablet/mobile and accessibility checks |
| Offline/PWA | expected offline messages, reload resilience, no stale sensitive/answer-key caching | network outage test + safe cache scope |
| Reporting/Print | filters/access scope, PDF/print layout, no leaked PII | rendered export + negative auth + data reconciliation |
| Pedagogy | diagnostic, mastery, adaptive paths, spaced review, feedback, Bloom, analytics | tests for skill evidence and intervention outcome, no fabricated scores |
| Operations | structured logs, traces, metrics, health/live/ready, graceful shutdown, backups, RPO/RTO | observed metrics/restore drill/alert simulation |
| Realtime | reconnect, authorization, durable result, no live answer key leakage | socket/cross-role integration tests |
| AI | provider budget, no PII leakage, trusted context, fallback, model nondeterminism | bounded inputs and falsification tests |
| Commerce | provider webhook authenticity, exact-price server, refund, idempotency, entitlement | integration/negative/replay tests |
| Delivery | PR gates, exact SHA, required checks, staging separation, cost | GH checks+release SHA evidence |

**فروق مثبتة حاليًا:** Scanning ليس ظاهرًا في Backend/Frontend workflows المفحوصة؛ `docs/ALMEAA_ENGINEERING_PILLARS_MASTER.md` غير موجودة في main؛ `/health/live` و`/health/ready` موجودتان؛ Redis/adaptive/Skeleton موجودة بدرجات مختلفة؛ Cloudinary staging مذكور في render.yaml مقابل R2 مستهدف. غير ذلك يُراجع ولا يوسم MISSING من اسم الملف.

## سياسة الأداء الصحيحة

لا تضع Redis cache في كل endpoint أو `loading=lazy` لكل صورة؛ صور above-the-fold تُقاس LCP ويجب أن لا تتأخر بلا داع. صور الأسئلة العربية/الرياضية تحتفظ بوضوحها وأبعادها. لا تستخدم Skeleton يخفي خطأ 401/500. لا تحوّل `Cache hit ratio` أو `500ms` إلى SLA عالمي قبل baseline. راجع access + invalidation + stale requests/role context.

## Operations Research — خطة تصميم لاحقة، لا كود P0

### OR-1: تجميع اختبار بحدود صارمة (أول POC)
- **Input:** pathId, subjectId, skill weights, difficulty/coverage, question count, duration, available approved question versions, published scope, entitlement/assessment audience.
- **Hard constraints:** question version approved, exact path/subject/tenant scope, rights/access, no duplicate canonical question, no leaked answer keys, compatible question type/timing, bounded resource use.
- **Soft objectives:** cover skills fairly, balance difficulty/exposure, minimize overused items, approximate target duration.
- **Output:** deterministic assembly proposal plus feasibility/failure reason, versioned rationale; Assessment owner creates immutable authorized version (optimizer never writes score/evidence).
- **Test:** infeasible constraints, small bank, same student retry, revoked access, cross-school, reproducibility, no change to existing exams by default.

### OR-2: خطة مذاكرة شخصية
- **Input:** existing `MasteryEvidence` and `SkillProgress`, available time, prerequisites, content/access, review due, constraints on workload.
- **Objective:** maximize expected coverage/priority under time constraints; compare with *existing* `RankAdaptiveProgress` baseline. Do not claim measured learning gain until validated pedagogically.
- **Output:** suggested sessions with reasons and opt-out/override. `Go` remains source of learning truth, optimizer does not mutate mastery.

### OR-3: جدولة المدارس
- **Input:** real teacher availability, classroom constraints, grade/subject counts, minimum lessons, contract limits.
- **Output:** proposed conflict-free timetable with human override; no assumption such data currently exists.

### Architecture and governance

Start with a small deterministic implementation in Go within the correct owning domain, or a pure domain service behind interface. Only if benchmark/ADR justifies complexity consider OR-Tools official Python/C++/Java/C# through an isolated worker; Go is not among the official primary OR-Tools language APIs. Feature flag, timeout, fallback, cost budget, privacy, versioning and comparisons required. No production activation under this P0 handoff.
