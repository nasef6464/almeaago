# Learning Remediation / Mastery Review Loop Audit

Status: **IN REVIEW**

## Scope

This checkpoint closes the deterministic ReviewCard answer loop without creating a second Assessment engine.

Flow:

```
Due ReviewCard
  -> learner-safe exact Question projection
  -> one server-scored answer
  -> review_answer_submission
  -> mastery_evidence(remediation | mastery_review)
  -> ReviewCard SM-2 advance
  -> skill_progress recompute
```

Assessment remains the owner of formal Assessment attempts/results. Learning owns this per-card review event loop.

## Data model

Migration: `000023_learning_review_loop`.

New table:
- `review_answer_submissions` — one immutable learner/card answer event with bounded idempotency key, selected canonical option, server correctness, evidence type, and resulting next-review snapshot.

`mastery_evidence` is extended so:
- `assessment` evidence still requires the canonical Assessment attempt source.
- `remediation` / `mastery_review` evidence requires a canonical Review submission source.
- exactly one review evidence row can reference one Review submission/question.
- no fake Assessment row is created for review practice.

## Security / secrecy

Before answer:
- due discovery returns question text/options/media references only.
- `correctOptionIndex`, explanation, hint and solving strategy are absent from the HTTP projection.
- Question Bank remains canonical; Learning composes exact versioned Question rows through the existing internal batch contract.

On answer:
- authenticated Student + CSRF required.
- client cannot send correctness, quality, evidence type or answer key.
- server verifies the selected option exists on the exact Question version.
- server computes correctness against the canonical answer.
- answer key/explanation are returned only after the immutable answer event is accepted.

## Idempotency / concurrency

- submission key is bounded to 8..160 chars and unique per learner.
- retry with the same key/card/option returns the original submission result without applying evidence again.
- reuse of the same key for a different card/option conflicts.
- the client sends the ReviewCard `updatedAt`; stale/concurrent state conflicts before evidence insertion.
- repository locks the learner-owned ReviewCard while applying one answer.
- answer submission is rejected if the card is no longer due.

## Review scheduling

The existing deterministic SM-2 function remains authoritative.

Quality mapping for this loop:
- incorrect = 2.
- correct = 4.

Pre-answer ReviewCard context determines evidence type:
- `error_recovery` -> `remediation`.
- otherwise -> `mastery_review`.

Post-answer card state:
- correct -> `mastery_review`.
- incorrect -> `error_recovery`.
- historical `has_mistake` remains independent and is not erased by a later correct answer.
- saved-for-review remains an independent reason.

## Mastery recomputation

SkillProgress aggregates all canonical evidence for affected skills.

Attempt/event count uses one source identity per evidence event:
- Assessment source attempt ID, or
- Review submission ID.

This prevents review evidence from being ignored and prevents replayed submissions from incrementing mastery twice.

## Query budgets

Due practice:
- exact learner only.
- path required; subject optional.
- tabs: saved / mistakes / all.
- `next_review_at <= now()`.
- default 20, max 50.
- `limit+1 / hasMore`; no exact-count scan.
- card rows first, one batched card-skill read, one bounded Question Bank batch.
- no per-card Question query.

## React / E2E

- existing `/review` exposes entry into due practice for the selected path/subject/tab.
- `/review/practice` renders one question at a time.
- the option key and explanation are absent before submission.
- after server scoring, correct answer + explanation + next review time are rendered.
- mobile Playwright evidence covers an incorrect remediation answer and completion of the bounded batch.

## Deliberately deferred

- Smart Tutor / AI hints.
- Realtime classroom evidence.
- Commerce entitlement.
- study plans/goals/interventions.
- school/parent aggregate reporting.
- formal Assessment result generation for Review practice.

Those remain separate domain slices.
