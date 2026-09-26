# Learning School Interventions Audit

Status: **IN REVIEW**

## Legacy contract verified
The legacy intervention flow was not merely an administrative note. It linked a school/class
student to one skill, captured baseline evidence, created a Study Plan, supported
active/completed/cancelled lifecycle, optional follow-up and remediation threshold, minimum
evidence, and a later outcome snapshot.

The legacy school director create flow generated a 14-day active Study Plan with 30 daily
minutes and a 17:00 preferred start. V2 preserves those evidenced defaults but replaces the
legacy loose action reference with an actual relational Study Plan ID.

## Ownership boundaries
Learning owns:
- intervention lifecycle.
- linked Study Plan creation.
- baseline/outcome evidence projection.
- minimum-evidence confidence and threshold comparison.

Organizations owns:
- school/class structure.
- school-admin permissions.
- supervisor school/class scopes.
- active student membership in the exact class.

Taxonomy owns:
- canonical active path/subject/skill identity.

No Learning repository query reads Organizations or Taxonomy tables to infer authority.
Narrow resolver interfaces compose those owner-domain checks at the application boundary.

## Authorization
- platform admin is allowed for operational administration.
- school admin manage requires `SCHOOL_INTERVENTIONS_MANAGE`.
- school admin view accepts `SCHOOL_INTERVENTIONS_VIEW` or manage.
- supervisor authority requires an active school or matching class scope.
- a class-scoped supervisor cannot list the whole school without `classId`.
- create revalidates that the target is an active student member of the exact active class.
- all staff mutations require CSRF.
- learner `/mine` is student-only and self-owned.

## Relational integrity
Migration `000027_learning_school_interventions` stores:
- school/class/student.
- canonical path/subject/skill.
- immutable `study_plan_id`.
- lifecycle + assigned_by.
- follow-up/threshold/minimum-evidence policy.
- compact baseline and outcome snapshots.

One active intervention per exact school/class/student/skill is enforced by a partial unique
index. Intervention history is retained instead of destructive replacement.

## Study Plan integrity
Intervention create generates the Study Plan through the existing bounded Study Plan candidate
composition rules, then inserts the plan and intervention in one transaction.

The learner can read/use the generated plan, but while the intervention is active:
- self-owned Study Plan update fails closed.
- self-owned Study Plan delete fails closed.
Staff never receives generic Study Plan mutation authority.

## Evidence / outcome
Baseline and outcome are aggregates of canonical `mastery_evidence` joined through
`mastery_evidence_skills` for the exact student/path/subject/skill.

Outcome evidence is measured strictly after intervention creation. The service reports:
- `insufficient` until minimumEvidence is met.
- `measured` with delta once enough new evidence exists.
- optional thresholdMet when remediationThreshold is configured.

No score or mastery is invented when evidence is missing.

## Performance
- staff list: default 50, max 100, limit+1/hasMore.
- learner list: default 20, max 50, limit+1/hasMore.
- supervisor reads require exact class when class-scoped.
- UI school/class/student selectors are bounded by existing Organizations APIs.
- Taxonomy is loaded once as its bounded bootstrap.
- no exact-count query was added to Learning intervention lists.
- Study Plan schedule candidate limits remain the previously tested Study Plan contract.

## Audit
Create/update/measure mutations write Operations audit events inside the same database
transaction as the intervention mutation.

## UI / E2E gate
- school director/supervisor responsive management screen.
- canonical school context, scoped classes, roster and Taxonomy selectors; no manual IDs.
- create, outcome measure and complete lifecycle.
- student `/plan` shows active school intervention context and the linked Study Plan.
- Playwright must prove director lifecycle, class-scoped supervisor request shape and mobile
  learner visibility before merge.

## Deferred
This slice does not add:
- Realtime classroom orchestration.
- Commerce entitlement.
- AI-generated interventions.
- staff-wide generic Study Plan CRUD.
