# 10 — Target Architecture: Go + React + PostgreSQL

## 1. القرار

Frontend:
- React + TypeScript.
- إعادة تنظيم Feature-first، لا إعادة كتابة إلى Angular بلا ضرورة.

Backend:
- Go.
- net/http + Chi أو router خفيف.
- OpenAPI contract.

Database:
- PostgreSQL.
- pgx + sqlc.
- JSONB فقط للmetadata المرنة.

Infrastructure:
- Redis.
- Cloudflare R2.
- WebSocket.
- background workers.
- OpenTelemetry + Sentry.
- Docker + GitHub Actions.

Architecture:
**Modular Monolith first.**

## 2. لماذا Modular Monolith؟

المشروع كبير Domain-wise لكنه ليس في حاجة مثبتة إلى شبكة microservices.

فوائد:
- transaction boundaries أبسط.
- deployment واحد.
- tracing أقل تعقيدًا.
- internal calls بدون network.
- يمكن استخراج AI/realtime/reporting لاحقًا إذا أثبت الحمل ذلك.

## 3. Go module boundaries

```
internal/
  identity/
  organizations/
  taxonomy/
  content/
  questionbank/
  assessment/
  learning/
  commerce/
  parents/
  ai/
  communication/
  realtime/
  reporting/
  operations/
  media/
```

كل Module:
- domain/
- application/
- repository/
- transport/http/
- infrastructure/
- tests/

## 4. Dependency rules

- transport -> application.
- application -> domain/repository interfaces.
- infrastructure implements repositories.
- no handler SQL.
- no cross-module table query except through declared read model/service where required.
- reporting can use dedicated read repositories without mutating foreign domains.

## 5. PostgreSQL Core Schema

### Identity
- users
- auth_sessions
- email_verifications
- password_resets
- global_roles

### Organizations
- schools
- school_contracts
- school_memberships
- school_membership_permissions
- classes
- class_memberships
- teaching_assignments
- parent_student_relationships

### Taxonomy
- paths
- levels
- subjects
- main_skills
- skills/subskills
- optional taxonomy_versions

### Content
- courses
- course_modules
- lessons
- lesson_skill_links
- foundation_topics
- topic_skill_links
- topic_lessons
- library_items
- content_assets
- content_review_events

### Question Bank
- questions
- question_versions
- question_options
- question_skill_links
- question_sources
- question_assets
- question_ai_context
- question_voice_explanations

### Assessment
- assessments
- assessment_versions
- assessment_sections
- assessment_version_questions
- assessment_learning_placements
- assessment_assignments
- assessment_sessions
- attempts
- answers
- results
- result_skill_summaries
- result_question_review_snapshots

### Learning
- lesson_progress
- skill_progress
- mastery_evidence
- mastery_goals
- review_cards
- study_plans
- interventions

### Commerce
- products
- packages
- package_items
- prices
- discount_codes
- payment_requests
- payment_events
- entitlements/access_grants

### AI
- ai_provider_configs
- ai_prompt_versions
- ai_interactions
- ai_usage_ledger
- ai_cache_entries

### Communication
- notification_templates
- notification_campaigns
- notification_deliveries
- discussion_threads/replies

### Realtime
- classroom_sessions
- classroom_participants
- classroom_batches
- classroom_responses
- classroom_report_snapshots

### Operations
- audit_log
- client_events
- backup_runs
- integration_settings/history

## 6. IDs

- internal UUID/ULID strategy consistent.
- public stable codes where product needs human traceability.
- questionCode remains immutable business identifier.
- no dual `_id + id` ambiguity in new schema.

## 7. Flexible JSONB

Use for:
- AI context.
- source metadata extensions.
- provider raw metadata.
- presentation settings.
- limited immutable snapshots.

Do not use JSONB to hide relationships that need joins/constraints.

## 8. API

Versioned `/api/v1`.

Conventions:
- problem/error envelope.
- request ID.
- pagination.
- filter.
- idempotency key.
- ETag/version where useful.
- OpenAPI generated TS client.

## 9. Auth

Recommended:
- secure HttpOnly cookies or explicit secure token strategy.
- short access lifetime.
- refresh/session table.
- session revocation.
- password-changed/session version.
- CSRF if cookies.
- Redis distributed rate limits.

## 10. Transactions

Required examples:
- payment confirmation + entitlement.
- assessment submit + result/evidence side effects.
- school student transfer/update.
- question import identity/version.
- permission grant/revoke.

## 11. R2

Go issues presigned URLs.
Client uploads directly.
PostgreSQL stores asset metadata and reference.
Object key hashing/versioning.
No binary in database.

## 12. Redis

- rate limits.
- queue.
- cache.
- websocket fanout.
- locks.
- short-lived session/realtime state.

PostgreSQL remains durable truth.

## 13. Workers

Same repository, separate commands/processes:
- api
- worker
- scheduler optional

Avoid separate repos/services until operationally justified.

## 14. Frontend structure

```
src/
  app/
  features/
    auth/
    learning/
    question-bank/
    assessment/
    schools/
    classroom/
    commerce/
    ai/
    reports/
  shared/
    ui/
    api/
    auth/
    types/
    telemetry/
```

No 100k-line managers.

## 15. Migration strategy

Because current data is test/demo:
- no production data migration requirement.
- design clean schema.
- generate deterministic seed.
- import only test/reference data needed.
- keep old platform read-only reference during parity work.
- switch only after parity proven.

## 16. Extract later only if measured

Potential future services:
- realtime classroom.
- AI voice/tutor.
- reporting warehouse.
- media processing.

Do not extract by fashion.
