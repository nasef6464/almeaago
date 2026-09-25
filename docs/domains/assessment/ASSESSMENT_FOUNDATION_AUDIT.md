# Assessment Foundation Audit

Status: **SCHEMA FOUNDATION IN REVIEW**

## Sources reviewed

Target design is grounded in:
- `docs/blueprint/04_ASSESSMENT_ATTEMPTS_RESULTS_AR.md`
- `docs/blueprint/02_ROLES_SCOPES_RELATIONSHIPS_AR.md`
- `docs/blueprint/15_TARGET_RELATIONSHIP_ERD_AR.md`
- `docs/blueprint/18_MODULE_API_BOUNDARY_MAP_AR.md`
- `docs/architecture/HOT_ENDPOINT_BUDGET_AR.md`
- legacy `Quiz`, AssessmentVersion/Assignment/Attempt/Response/Result models
- legacy assessment classification/settings compatibility contracts.

## Canonical decisions

Assessment is split into five authorities rather than one legacy Quiz document:

1. **Definition identity** — `assessments`.
2. **Immutable/versioned definition content** — `assessment_versions`, sections and exact question-version placements.
3. **Distribution** — learning placements, directed assignments and public/barcode/live sessions.
4. **Learner execution** — attempts and autosaved answers.
5. **Final result** — one server-owned result plus bounded section/skill summaries.

Legacy vocabulary is not copied literally:
- `drill` -> normal/practice.
- `test` -> normal/exam.
- true mock -> mock.
- `mode=central` -> Assignment/Distribution, not Assessment kind.
- `mode=saher` -> self-delivery/origin, not Assessment kind.
- `placement/showInTraining/showInMock` -> explicit placement rows.
- target user/group arrays -> relational assignment audience rows.

## Question Bank boundary

Assessment never copies Question payloads.

Every version placement stores:
- canonical `question_id`.
- exact immutable `question_version`.

This protects historical meaning while allowing the Question Bank to remain the sole question/answer-key owner.

Learner answers reference the same exact assessment/question versions. A selected option must reference an existing Question Bank option through a foreign key.

## Settings

The first schema stores the verified canonical settings explicitly:
- explanation/answer/report visibility.
- return-to-source behavior.
- max attempts.
- passing score.
- time limit in **seconds**.
- question/option randomization.
- progress bar.
- require-answer-before-next.
- question review.
- option layout.

Legacy `timeLimit` minute values require an adapter conversion; the target database does not keep an ambiguous unit.

Mock-only fields are structurally separated and must be absent on normal assessments.

Schema support does **not** mean a setting is product-supported. The builder -> API -> persistence -> reload -> runner -> result acceptance rule still applies before any setting is exposed as complete.

## Distribution

Definition content is not duplicated into distribution records.

- Learning placement links one exact Assessment version into training/tests/Foundation/Course locations.
- Directed Assignment stores window/status and relational user/class audiences.
- Session stores a channel and stable code for public/barcode/live delivery.

Commerce access is intentionally absent from Assessment placement rows. Entitlement remains Commerce/Access authority.

## Attempt integrity

- Attempts always point to an exact Assessment version.
- assignment/session/placement context is at most one source per attempt.
- context foreign keys must refer to the same Assessment version.
- separate partial unique indexes prevent duplicate attempt numbers for self, assignment, session and placement contexts.
- optional `start_key` and `submission_key` are unique idempotency anchors.
- submitted status requires a submitted timestamp.
- expiration must be later than start.

Client local state is never source of truth.

## Answer secrecy and scoring

- Correctness is server-owned and nullable until scoring.
- answer-key data is not stored in attempt payload rows.
- selected options must exist in the exact Question version.
- normal autosave writes one latest row per attempt/question.
- result is one row per attempt with count consistency constraints.
- section and skill summaries are separate rows; result-list endpoints do not need to hydrate question review.

No API in this schema batch is allowed to expose `is_correct`, correct options, explanations or private Question metadata before submission policy permits it.

## Query/index intent

Indexes correspond to known hot paths:
- staff Assessment workflow/owner/assignment lists.
- exact version question order and question reuse lookup.
- placement by taxonomy/slot.
- assignments/sessions by version/status.
- attempts by student and by Assessment/status.
- active resume lookup.
- answers by attempt.
- result summaries by student/Assessment.
- skill summary lookup.

Normal list APIs must remain bounded. No exact-count requirement is introduced by this schema.

## Deliberately deferred

This batch does **not** implement:
- Assessment application/repository/HTTP contracts.
- staff builder/UI.
- student runner/autosave/submit.
- server scoring transaction.
- directed scope authorization.
- result/review presentation.
- Learning mastery side effects.
- Realtime classroom/session orchestration.
- Commerce entitlement checks.
- migration/backfill from legacy Mongo.

Those follow after this schema passes apply/rollback/re-apply CI.

## Next batch after merge

Build the Assessment definition/version application contract first:
- bounded staff list/detail.
- draft create/update/version composition.
- Question Bank exact-version validation.
- explicit review/publish workflow.
- teacher/school scope authorization.
- transactional audit.

Do not start learner attempts until the definition/version contract is green.
