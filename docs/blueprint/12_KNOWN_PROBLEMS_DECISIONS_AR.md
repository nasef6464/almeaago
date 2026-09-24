# 12 — Known Problems, Legacy Drift & Decisions

هذا الملف يفصل بين Feature وبين Debt/Bug حتى لا تنسخ النسخة الجديدة أخطاء القديم.

## 1. Dual identity `_id` + custom `id`

**Status: VERIFIED debt.**

عدة Models تحمل Mongo _id ومعرف public/custom.
Target: one internal ID strategy + explicit public codes فقط عندما لها معنى.

## 2. User relationship arrays + canonical relations

**Status: VERIFIED transitional design.**

User legacy arrays coexist with:
- SchoolMembership.
- ParentStudentRelationship.
- TeachingAssignment.
- AccessGrant.

Target: canonical relational tables only؛ compatibility adapter مؤقت إن احتجنا.

## 3. Question skill compatibility fields

Question has:
- skillIds canonical direction.
- skillId/subSkillId legacy fields.
- sectionId used as main skill scope in current taxonomy.

Target: explicit normalized question_skill links + taxonomy level semantics.

## 4. Counter semantics

Current coverage uses sectionId/main skill + skillIds classification.
Potential confusion when question has multiple skills.

Decision:
document COUNT DISTINCT rules in new system and test multi-skill cases.

## 5. Hard deleting Question

Current delete cascades IDs out of quizzes.
Risk: historical attempt/result references should not lose interpretability.

Target:
archive/retire by default.
hard-delete only unused draft or retention-approved object.

## 6. Editor image keys vs import image keys

Current:
- editor uploads random UUID path.
- V2 imports are content-addressed by questionCode/hash.

Target:
unify asset registry/checksum dedupe where practical.
Do not force user editor to know hash; client/backend can compute/check.

## 7. Process-local question summary cache

Current small Map cache is not shared.
Target Redis/shared cache or remove.
Never depend on it for correctness.

## 8. Assessment legacy vocabulary

Current coexistence:
- quizKind.
- mode regular/saher/central.
- placement/showInTraining/showInMock.
- learningPlacements.
- mockExam.

Target canonical:
Assessment kind + Delivery + Placement + Assignment/Session.
Legacy mappings stay only in migration adapter.

## 9. Settings drift history

Historical assessment audit showed fields could appear in Builder without full runner effect.

Decision:
round-trip acceptance rule mandatory for every setting.

## 10. Review/Favorites legacy

Historical frontend arrays favorites/reviewLater coexist with server ReviewCard.
Recent Student Review direction unifies review server-side.

Target:
one ReviewItem/ReviewCard source.
No third review system.

## 11. Historical answer exposure bugs

Old audit recorded correct answer/explanation exposure in result routes.
Current question presentation includes learner sanitizer for question-bank responses, and later assessment hardening exists.

Status: **REVERIFY across every attempt/result/review endpoint**.
Do not assume old bug still exists; do not assume it is fully fixed without security tests.

## 12. Historical broad RBAC risk

Old discussion/content routes had scope gaps in earlier audits.
Many later school/RBAC gates exist.

Status: REVERIFY by endpoint in new build, using deny tests.

## 13. Large frontend files

Current hotspots include very large:
- Reports.
- Dashboard.
- QuizPage.
- Admin managers.

Target:
feature decomposition + view models/hooks + API clients.
Do not mechanically port giant files.

## 14. Broad bootstrap

Current App has route-based bootstrap/defer logic to reduce loading.
This reflects prior pressure from broad data hydration.

Target:
page/feature-scoped APIs from first design.

## 15. Data retention

Exact TTL/retention for:
- AI interactions.
- telemetry.
- notifications.
- audit.
- payment.
- academic history
is business/legal policy not fully settled.

Target must include retention matrix before automated deletion.

## 16. Production evidence boundary

Current platform uses test fixtures and has no real users in current project stage.
Historical docs may use phrases production-ready for isolated gates.

For new build:
- CI pass != production scale.
- staging load != real production proof.
- every claim labels evidence environment.

## 17. R2/CDN

Moving images to R2 was a deliberate response to:
- bandwidth.
- DB/server storage.
- duplicate media.
- API payload size.

Target preserves direct upload + CDN strategy.

## 18. AI ambiguity

Provider names/config changed over project evolution.
Do not encode a vendor as core business logic.
Use adapter/config capability.

## 19. School relationships

Group arrays and school relationships evolved over time.
Target separates membership, class membership, teaching assignment, supervision, entitlement.

## 20. No silent “improvements”

Agent may propose improvements in PROPOSALS.md.
It cannot change baseline parity without marking INTENTIONALLY_CHANGED and owner decision.
