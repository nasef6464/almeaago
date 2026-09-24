# 06 — Schools, Classes, B2B & Smart Classroom

## 1. School Operating Model

Current School MVP verified capabilities:
- Admin creates school.
- creates classes.
- adds/imports students.
- creates login accounts.
- relates teachers/supervisors.
- manages packages/access.
- teacher/supervisor scope.
- student/parent isolation.

## 2. Core entities

Target relational model:

```
schools
school_contracts
school_contract_modules
school_memberships
school_membership_permissions
classes
class_memberships
teaching_assignments
school_supervisor_scopes
parent_student_relationships
school_packages
access_grants
```

## 3. Single Account / Multi-context

طالب واحد لا ينشأ له حساب ثانٍ بسبب المدرسة.
نفس user:
- self-study context.
- school context.
- different access/report source.

Context switch لا يغير identity ولا role بشكل غير مضبوط.

## 4. Membership vs Class vs Assignment

- SchoolMembership = الانتماء والدور.
- ClassMembership = الطالب في الفصل.
- TeachingAssignment = المعلم + الفصل + المادة.
- Supervisor scope = ما يشرف عليه.
- AccessGrant = ماذا يستطيع استهلاكه.

لا نجمع هذه المعاني في array واحدة.

## 5. School Contract

INTENDED/current school design:
العقد يحدد:
- modules enabled.
- paths/courses.
- question bank access.
- smart classroom.
- live tutoring.
- analytics.
- branding.
- seat limits.
- concurrent session limits.
- start/end/status.

Target: entitlement policy enforced server-side.

## 6. School Admin/Director Delegation

Permission set per membership.
Admin platform grants/revokes.
Director cannot self-elevate.

Examples:
- student management.
- class management.
- teaching assignments.
- school reports.
- assessments.
- smart classroom.
- interventions.

## 7. Student roster

Roster queries:
- bounded/paginated.
- minimal PII.
- school + class authorization first.
- no global user load on frontend.

## 8. Smart Classroom Product

Journey:

1. Teacher chooses school/class/subject/skills.
2. selects a bounded question batch from canonical Question Bank.
3. creates/starts session.
4. projector shows PIN/QR.
5. authorized students join.
6. attendance/presence recorded.
7. teacher pushes question.
8. students answer.
9. live aggregate/distribution.
10. teacher reveals solution when allowed.
11. batch ends.
12. next batch possible.
13. session ends.
14. immutable report snapshot.
15. weakness can trigger intervention/remedial plan.

## 9. Realtime entities

Current models include:
- ClassroomSession.
- ClassroomParticipant.
- ClassroomResponse.
- ClassroomTemplate.

Target may use:
- classroom_sessions.
- classroom_participants.
- classroom_question_batches.
- classroom_questions.
- classroom_responses.
- classroom_report_snapshots.

## 10. Session state

States should be explicit.
At most one active/live session per school+class per policy.

End batch/session idempotent.
Ended report immutable.

## 11. Question snapshot policy

Live session may need limited immutable snapshot for integrity:
- question ID/version.
- text/options necessary at presentation.
- correct key private to server.
- explanation according reveal policy.

Do not copy image bytes.

## 12. Attendance

INTENDED:
- join method: QR/PIN/dashboard CTA.
- joinedAt.
- present/late/absent/excused.
- teacher override with audit.
- roster match required.

## 13. Live analytics

Per-question, not blended accidentally:
- response count.
- option distribution.
- accuracy.
- response time.
- no cross-question pollution.

## 14. Teacher reports

DB-backed history is source of truth.
LocalStorage only offline/cache fallback.
No fake estimate مثل answeredCount*0.6.

## 15. Intervention Bridge

Weak class/skill:
- identifies target students.
- proposes/creates remedial support.
- records source evidence.
- schedules live/lesson/practice.
- does not duplicate students/content.

## 16. Dual-source analytics

School performance vs platform self-study remain distinguishable via learning context:
- school assessment.
- smart classroom.
- self-study.
- remedial.

يمكن عرض مقارنة، لكن لا يدمج رقمان مختلفان بلا تعريف.

## 17. B2B Package

Current B2B fields include:
- schoolId
- courseIds
- contentTypes
- pathIds
- subjectIds
- maxStudents
- teacher assignment/revenue fields
- status

Target separates:
- commercial contract.
- purchased package definition.
- entitlement grants.
- seat usage.

## 18. Cross-school invariants

- A actor never accesses B data.
- guessed ID does not bypass.
- revoked membership denies immediately.
- teacher assignment end blocks active classroom control.
- historical report access policy explicit.
- school_admin cannot grant platform admin.
