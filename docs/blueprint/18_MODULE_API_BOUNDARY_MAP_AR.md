# 18 — Module & API Boundary Map

## 1. Target Modules

### identity
Owns:
- user identity.
- login/session/password/email/OTP.
Does not own:
- school membership.
- entitlement.
- learning progress.

### organizations
Owns:
- schools.
- memberships.
- classes/groups.
- teaching assignments.
- parent relations/delegation.
Calls:
- commerce entitlement resolver.
- reporting read models.

### taxonomy
Owns:
- paths, levels, subjects, skills hierarchy.
Rules:
- stable IDs.
- no question ownership.

### content
Owns:
- courses/modules/lessons.
- foundation topics.
- library metadata.
- content workflow.
Links to taxonomy by IDs.

### media
Owns:
- asset metadata.
- presigned uploads.
- checksum/dedupe policy.
- R2 object lifecycle.
Does not own Question/Lesson business rules.

### questionbank
Owns:
- question identity/version/options.
- source provenance.
- skill links.
- question workflow.
- AI/voice references.
Does not own assessment placement.

### assessment
Owns:
- definition/version.
- sections/questions.
- assignment/session distribution metadata.
- attempt/answers/submit/result core.
Calls:
- questionbank read contract.
- learning evidence application.
- organizations scope.
- commerce entitlement.

### learning
Owns:
- lesson progress.
- skill progress/mastery.
- evidence.
- review cards.
- goals/plans/interventions.
- next-best-action deterministic resolver.

### commerce
Owns:
- products/packages/prices.
- discounts.
- payments/events.
- entitlements/access.
Does not mutate User arrays.

### parents
May be boundary داخل organizations أو façade:
- linked student authorization.
- parent-specific reports.
No direct unrestricted user reads.

### communication
Owns:
- notification templates/campaigns/deliveries.
- discussions/Q&A.
Uses queue/provider adapters.

### realtime
Owns:
- smart classroom live lifecycle.
- websocket protocol/presence.
- durable classroom records.
Uses canonical questions and school scope.

### ai
Owns:
- provider policy.
- prompts.
- interactions/usage/cache.
- tutor orchestration.
Must not own scoring/mastery truth.

### reporting
Owns read models:
- student/class/school/platform aggregates.
- exports.
No business-state mutation except report job lifecycle.

### operations
Owns:
- audit.
- health/readiness.
- backups.
- telemetry.
- integration config/history.
- privacy lifecycle orchestration.

## 2. Allowed high-level dependencies

```
identity <- all authenticated modules
taxonomy <- content/questionbank/assessment/learning
organizations <- assessment/realtime/reporting
media <- content/questionbank/ai
questionbank <- assessment/realtime/learning-review
assessment -> learning (evidence event)
commerce -> entitlement checks used by content/assessment
ai -> reads bounded context from questionbank/learning, not direct DB joins
reporting -> read repositories/events from domains
```

Prefer domain service/interface, not foreign SQL tables.

## 3. API Families target

`/api/v1/auth/*`
`/api/v1/users/*`
`/api/v1/schools/*`
`/api/v1/classes/*`
`/api/v1/taxonomy/*`
`/api/v1/learning-spaces/*`
`/api/v1/courses/*`
`/api/v1/lessons/*`
`/api/v1/foundation/*`
`/api/v1/library/*`
`/api/v1/questions/*`
`/api/v1/assessments/*`
`/api/v1/attempts/*`
`/api/v1/results/*`
`/api/v1/review/*`
`/api/v1/mastery/*`
`/api/v1/payments/*`
`/api/v1/entitlements/*`
`/api/v1/notifications/*`
`/api/v1/classroom/*`
`/api/v1/ai/*`
`/api/v1/reports/*`
`/api/v1/media/*`
`/api/v1/operations/*`

هذه أسماء target مبدئية؛ OpenAPI inventory يحدد exact endpoints بعد parity discovery.

## 4. Endpoint design rules

- plural resources.
- nested only when scope semantically required.
- filters via query.
- page/cursor contract common.
- response DTOs, never raw DB rows.
- no answer keys in learner DTO.
- no secrets in integration DTO.
- request IDs/errors consistent.
- idempotency headers/keys for submit/payment/import.
- optimistic/version conflict where editing published content.

## 5. Command vs Query

Heavy/privileged write:
- command endpoint with audit.

Large export:
- create export job -> poll/download asset.

Read models:
- optimized read endpoint; do not force domain write model schema into every dashboard.

## 6. Events

Internal domain events useful:
- QuestionApproved.
- AssessmentPublished.
- AttemptSubmitted.
- SkillEvidenceRecorded.
- EntitlementGranted/Revoked.
- SchoolMembershipChanged.
- ClassroomEnded.
- PaymentConfirmed.
- NotificationRequested.

Initially in-process + transactional outbox where reliability required. Do not add Kafka unless measured need.

## 7. Transactional Outbox PROPOSED

Useful for:
- payment -> entitlement -> notification.
- attempt submit -> mastery evidence/report events.
- school membership/permission -> cache invalidation.
- content publish -> search/cache invalidation.

PostgreSQL transaction commits business state + outbox event; worker publishes/processes.

## 8. File/package boundaries

Go:
```
cmd/api
cmd/worker
cmd/migrate
internal/<domain>/domain
internal/<domain>/application
internal/<domain>/repository
internal/<domain>/transport/http
internal/<domain>/infrastructure
internal/platform/{config,db,redis,telemetry,security}
api/openapi
migrations
```

React:
```
src/app
src/features/<domain>
src/shared/ui
src/shared/api
src/shared/auth
src/shared/types
src/shared/telemetry
```

## 9. Anti-patterns

- one giant routes.go.
- generic repository returning map[string]any.
- DB queries inside React.
- AI provider calls in HTTP handler.
- cross-domain SQL everywhere.
- copied Question object per assessment.
- copied media per workflow.
- dashboard loading entire databases.
