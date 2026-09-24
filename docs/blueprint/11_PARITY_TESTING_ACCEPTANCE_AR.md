# 11 — Parity, Testing & Acceptance Contract

## 1. معنى Done

لا تستخدم DONE لمجرد:
- build pass.
- HTTP 200.
- screen opens.
- database row exists.

Feature state:
- NOT_STARTED
- DISCOVERED
- SPECIFIED
- IMPLEMENTED
- TESTED
- PARITY_PROVEN
- BLOCKED
- INTENTIONALLY_CHANGED

## 2. Parity Matrix fields

لكل Capability:
- ID.
- name.
- actor.
- old UI route.
- old API.
- old models.
- rules.
- new module.
- new API.
- new tables.
- functional test.
- negative permission test.
- E2E.
- visual baseline.
- performance/bandwidth notes.
- status.

## 3. Four parity dimensions

1. Functional — يستطيع فعل نفس العمل.
2. Authorization — نفس/أقوى boundaries المقصودة.
3. Data — العلاقات والآثار الجانبية صحيحة.
4. Visual/UX — التجربة الأساسية لا فقد فيها.

## 4. Golden Journeys

### Student
- sign in.
- dashboard.
- path/subject.
- foundation.
- lesson.
- short practice.
- normal assessment.
- result/review.
- save/mistake.
- remediation.
- smart next action.

### Question Admin
- create text question.
- image question direct R2.
- assign taxonomy.
- explanation/AI/voice.
- draft/review/approve.
- filter/search/count.
- reuse in assessment.
- safe archive.

### Assessment Admin/Teacher
- create.
- choose questions across pages.
- configure.
- publish.
- assign.
- student attempt.
- resume.
- submit.
- result/analytics.

### School
- create school/class.
- roster.
- teacher assignment.
- supervisor.
- entitlement.
- student login.
- school assessment.
- report.

### Smart Classroom
- start.
- join.
- attendance.
- push batch.
- answer/revise.
- aggregate.
- end batch.
- next batch.
- end session.
- immutable report.

### Parent
- linked student only.
- result/progress.
- weekly report.

### Commerce
- product/package.
- discount.
- request.
- admin/webhook confirmation.
- access once.
- duplicate event no duplicate access.

### AI
- provider health.
- admin config.
- question assistant.
- cache.
- policy.
- failure fallback.

## 5. Negative Journeys

- cross-school.
- cross-student.
- unassigned teacher.
- revoked membership.
- learner answer-key endpoint.
- duplicate submit.
- duplicate payment webhook.
- invalid question skill.
- oversized/invalid media.
- expired signed upload.
- unentitled content direct URL.

## 6. Visual baseline

Capture old and new for:
- desktop.
- common mobile.
- critical tablet/projector where applicable.

Compare:
- navigation.
- spacing.
- labels.
- action availability.
- loading/error/empty.
- RTL.
- question presentation.
- assessment navigation.
- dashboards.

## 7. Contract Tests

OpenAPI/schema contract covers:
- exact fields.
- enums.
- defaults.
- pagination.
- error codes.
- security requirements.

## 8. Database Tests

- FK.
- unique constraints.
- transaction rollback.
- idempotency.
- migration from blank DB.
- seed repeatability.

## 9. Performance Gate

No claim “Go is faster” without test.

Record baseline and new:
- p50/p95/p99.
- request bytes.
- DB time.
- CPU/RAM.
- socket concurrency.
- job throughput.
- AI tokens.

## 10. Data integrity gates

Examples:
- one question code.
- no orphan question skill.
- no attempt without assessment version.
- no answer outside attempt version.
- no active entitlement without source.
- no teaching assignment outside school/class.
- no parent relation to missing users.
- no duplicate live classroom violating policy.

## 11. Release gate

Go-live candidate requires:
- all critical capabilities PARITY_PROVEN.
- no P0/P1 unresolved.
- backup/restore proof.
- security tests.
- load baseline.
- observability.
- rollback.
- secrets verified.
- deployment identity/commit proof.

## 12. Intentional differences

إذا الجديد يصلح bug أو يغيّر UX:
- سجل old behavior.
- reason.
- owner decision.
- new expected behavior.
- test.

لا تسمح للAgent بتغيير behavior بصمت.
