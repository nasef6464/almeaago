# Learning Evidence / Mastery / Review Foundation Audit

Status: **IN REVIEW**

## Scope

This checkpoint starts Phase 7 with the canonical learner evidence path:

```
Assessment submit
  -> exact submitted question outcomes
  -> mastery_evidence
  -> skill_progress
  -> review_cards
  -> bounded learner review/mastery APIs
```

It does not create a second assessment engine.

## Ownership and boundaries

Assessment remains authoritative for:
- submitted attempts.
- exact Assessment/Question versions.
- server scoring and result ownership.

Learning owns:
- evidence application.
- current skill mastery materialization.
- ReviewCard identity and spaced-review state.
- deterministic learner next-action text.

Question Bank remains authoritative for review question content. Learning reads exact question versions through a batched internal Question Bank contract and does not query Question Bank tables directly.

## Schema

Migration: `000022_learning_evidence_review`.

Tables:
- `mastery_evidence` — one canonical evidence row per evidence type + source attempt + question.
- `mastery_evidence_skills` — normalized multi-skill links for an evidence event.
- `skill_progress` — current materialized state per learner + path + subject + skill.
- `review_cards` — one canonical learner/question card with saved + mistake reasons and SM-2 state.
- `review_card_skills` — normalized card-to-skill links.

No growing arrays are stored on User or Question.

## Idempotency / retry contract

Assessment submission remains transactionally final before Learning is invoked.

After a successful Assessment submit:
1. Assessment returns the same canonical result for the same submission key.
2. Assessment builds an exact-version Learning evidence projection.
3. Learning inserts evidence with unique identity:
   `(evidence_type, source_attempt_id, question_id)`.
4. Duplicate retries insert zero new evidence.

If Learning application fails after Assessment has already committed, the HTTP submit returns an error. Retrying with the same Assessment submission key reuses the existing result and retries the idempotent Learning application. No duplicate result or evidence is created.

Anonymous Public/Barcode submissions are intentionally not mixed into account mastery; public-to-account identity claiming remains a separate explicit product flow.

## Mastery policy

The first Go/PostgreSQL policy preserves the documented legacy deterministic bands:
- `< 50` → weak.
- `50..<75` → average.
- `75..<90` → good.
- `>=90` → mastered.

Mastery is the evidence-weighted correctness percentage for the exact learner/path/subject/skill scope.

Recommended action preserves the legacy deterministic bands:
- `<45` → urgent explanation + practice + directed recheck.
- `45..<65` → short practice; after repeated attempts, stronger remediation.
- `>=65` → light reinforcement + later re-measure.

AI is not used to calculate mastery or next action.

## ReviewCard policy

Every submitted question can maintain one learner/question ReviewCard.

Incorrect or unanswered evidence:
- sets `has_mistake=true`.
- sets error-recovery review type.
- does not clear the mistake automatically on later correct evidence.

Correct evidence:
- enters the mastery-review scheduling state.
- does not erase an existing mistake reason.

Saved-for-review is an independent reason on the same card. A question never needs duplicate cards because it is both saved and mistaken.

Initial spaced-review scheduling uses the existing SM-2 policy:
- unanswered quality 1.
- incorrect quality 2.
- correct quality 4.

## Read/query budgets

Review library:
- exact learner only.
- requires `pathId`; `subjectId` is optional inside that path.
- tabs: `saved`, `mistakes`, `all`.
- default 20, max 50.
- `limit+1 / hasMore`; no exact-count scan.
- cards are loaded first, then all exact Question versions are composed in a bounded batch.
- no per-card Question query.

Mastery:
- exact learner only.
- requires `pathId`.
- progress default 50, max 100.
- next action is a single weakest-skill read in the selected scope.
- no all-question bootstrap or raw evidence history is sent to React.

## HTTP

Review:
- `GET /api/v1/review/library?tab=&pathId=&subjectId=&page=&limit=`
- `PUT /api/v1/review/questions/{questionId}/saved`
- `DELETE /api/v1/review/questions/{questionId}/saved`

Mastery:
- `GET /api/v1/mastery/progress?pathId=&subjectId=&page=&limit=`
- `GET /api/v1/mastery/next-action?pathId=&subjectId=`

Unsafe saved-review mutations require authenticated Student + CSRF.

## React checkpoint

- `/review` is path-scoped and optionally subject-scoped.
- learner sees mistakes, saved items, combined review, exact question review content and deterministic next action.
- result detail can add the canonical saved-for-review reason without creating a second card.
- mobile E2E covers the review/mastery surface.

## Deliberately deferred

This checkpoint does not yet implement:
- answering cards inside a dedicated remediation/mastery-review session.
- mastery challenge discovery/recheck attempts.
- lesson/video progress.
- study plans/mastery goals/interventions.
- school/parent aggregate reporting.
- Smart Classroom realtime evidence.
- Commerce entitlement.
- AI recommendations.

The next Learning batch should close the remediation/review attempt loop using canonical Question IDs/versions and idempotent evidence, rather than introducing another quiz engine.
