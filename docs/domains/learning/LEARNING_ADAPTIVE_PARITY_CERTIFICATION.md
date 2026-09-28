# Review / Adaptive Learning Integrated Parity Certification

Status: **CERTIFICATION CANDIDATE**

## Source basis
Audited against legacy commit `8724cd5081df75487e3207bf844e6db470fe0eda` and the target blueprint `05_STUDENT_LEARNING_FOUNDATION_AR.md`.

The source-backed loop is:
Assessment/Question evidence -> SkillProgress -> readiness / next action -> targeted review/resource -> remediation -> recheck.

## Already merged foundations
- canonical append-only mastery evidence + materialized SkillProgress.
- ReviewCard identity, saved/mistake reasons and SM-2 scheduling.
- server-scored remediation/mastery-review answer loop with idempotency and optimistic concurrency.
- normalized Course/Foundation Lesson/video progress.
- learner mastery goals.
- deterministic Study Plans.
- school interventions with baseline/outcome evidence and scoped Organizations authority.

## Certification addition: deterministic readiness
Legacy has an explicit internal readiness interpretation using mastery (55%), reliable-skill coverage (20%), evidence confidence (15%) and recency (10%), with minimum 3 evidence events per reliable skill. It is explicitly internal routing/explanation, not an external exam prediction.

V2 now exposes `GET /api/v1/mastery/readiness?pathId=&subjectId=` from the existing bounded SkillProgress projection. It is Student-only, path-scoped, AI-free and does not load raw attempt history or Question Bank. The Review surface displays the readiness explanation, coverage, reliable-skill count, evidence count and a clear non-prediction label.

## Safety / ownership
- Assessment owns formal attempts/results.
- Question Bank owns canonical question/answer content.
- Learning owns mastery evidence, review scheduling, readiness, goals, plans and interventions.
- Content owns learner-safe Lesson/resources.
- Organizations owns school/class/student staff authority.
- readiness never grants Commerce entitlement and never mutates evidence.
- no AI call participates in mastery/readiness/routing.
- insufficient evidence cannot become ready-to-advance.

## Product improvement rationale
The readiness card closes an important UX gap: a learner previously saw only the weakest skill and raw mastery. The added summary explains whether the evidence is broad/recent enough to act on, while keeping the product deterministic and honest.

## External evidence boundary
Deterministic V2 browser screenshots and CI prove implementation behavior, not pixel-perfect legacy-runtime parity. Do not claim PARITY_PROVEN without the required external/runtime evidence.
