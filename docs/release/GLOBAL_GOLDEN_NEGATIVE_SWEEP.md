# Global cross-domain golden journeys / negative-security sweep

Status: **CANDIDATE — implementation and evidence assembled; exact-head four-gate CI pending.**

## Scope and source of truth

This batch starts from `main@444a1a5c60838d7c4f81c1acd9be2c7012c275bc` and uses
`docs/blueprint/11_PARITY_TESTING_ACCEPTANCE_AR.md` as the acceptance contract. The legacy
repository remains read-only. The legacy checkpoint at batch start is
`nasef6464/almeaacodax@983b004d18818166bf97c9096411e2707551a0bd`.

This batch is not a production certification. Full visual side-by-side evidence, live staging/provider
proof, production-equivalent load/bandwidth, dated backup/restore, unresolved product-policy closure
and final release evidence remain separate gates.

## New evidence added in this batch

- `apps/web/tests/e2e/global-release-sweep.spec.ts` runs one authenticated learner through a
  cross-domain Content -> Assessment -> Result -> canonical ReviewCard -> Remediation -> Mastery
  journey. It explicitly checks that answer-key UI is absent before formal submit and again before
  server-scored remediation.
- Media direct-upload completion now fails closed when the recorded signed PUT authorization is
  missing or expired, before provider HEAD or asset activation.
- Media regression tests cover expired authorization, missing expiry, oversized uploads, invalid MIME,
  metadata mismatch and successful verified activation.
- Question Bank taxonomy validation was isolated behind the minimal `QueryRow` contract and now has
  direct regression tests proving foreign subject, foreign main skill, out-of-branch subskill and
  required-subskill rejection.
- Database CI now asserts Assessment start/submission idempotency uniqueness, Commerce provider-event
  uniqueness and the Question Bank skill-link primary-key invariant.

## Golden-journey evidence map

| Journey | Evidence in the current tree | Boundary proven |
| --- | --- | --- |
| Student | new `global-release-sweep.spec.ts` plus existing Content/Assessment/Review/Remediation browser specs | one browser identity crosses owner domains without browser-owned scoring/mastery |
| Question Admin | `questionbank-admin.spec.ts`, `questionbank-workflow.spec.ts`, Media service tests, Question Bank repository taxonomy validation | canonical Question/Media/Taxonomy ownership, bounded workflow and direct-upload integrity |
| Assessment staff + learner | `assessment-builder.spec.ts`, `assessment-assignments.spec.ts`, `assessment-attempt.spec.ts`, `assessment-results.spec.ts` | published version -> assignment/start -> server result/review |
| School | Organizations service-policy tests, school/director E2E, Reporting role-scope tests | school/class/assignment authority composes into reporting rather than duplicating truth |
| Smart Classroom | `classroom.spec.ts` + Realtime application tests | Organizations roster/assignment + canonical Question Bank + safe live state + immutable report |
| Parent | `parents-dashboard.spec.ts` + Parents application tests | canonical parent-child authority + Assessment/Learning read-only composition |
| Commerce | `commerce-checkout.spec.ts`, `commerce-foundation.spec.ts`, Commerce application/repository contracts | server price/payment truth -> entitlement once -> Content/Assessment access |
| AI | `ai-question-assistant.spec.ts` + AI application tests | owned ReviewCard context, provider policy, fallback/cache, no scoring/mastery mutation |

## Negative/security evidence map

| Required negative | Evidence / result |
| --- | --- |
| cross-school | Organizations permissions and exact school/class scopes fail closed; Learning intervention rejects students outside the canonical class; Realtime joins/attendance use canonical Organizations scope |
| cross-student | Assessment result/attempt reads bind to the authenticated student; Parents rejects an unlinked child before source-domain reads |
| unassigned teacher | Organizations teacher assignment directory is self-scoped; Realtime teacher control requires exact canonical assignment/scope |
| revoked membership | active membership/relationship queries are the authority; revoked parent relationship is filtered from the dashboard; legacy inactive membership maps to canonical revoked instead of remaining active |
| learner answer-key endpoint | Assessment result-review policy test strips private answer/explanation when disabled; Realtime hides key until reveal; new cross-domain browser journey proves no pre-submit/pre-remediation key |
| duplicate submit | Assessment repository serializes the attempt, reuses the same result only for the same `submission_key`, rejects a different key after submit; DB uniqueness and Learning handoff retry test prevent duplicate result/evidence |
| duplicate payment webhook | `commerce_provider_events(provider_code,event_id)` is unique; repository `ON CONFLICT ... DO NOTHING` returns `Duplicate:true` before entitlement grant |
| invalid question skill | new Question Bank repository tests reject foreign subject/main/sub branches and missing required subskill |
| oversized/invalid media | Media tests reject size above configured maximum and unsupported MIME |
| expired signed upload | **gap found and fixed in this batch**: completion now rejects missing/expired `UploadExpiresAt` before provider HEAD/activation |
| unentitled direct URL | Content Commerce access test rejects direct non-preview Course Lesson access and permits only source-backed preview bypass |
| role-safe realtime/provider | Realtime hides private keys and requires canonical join/control scope; AI rejects foreign ReviewCard before provider use and keeps provider secrets server-owned |

## Defect found by the sweep

Before this batch, Media `Complete` verified object size/MIME/hash but did not enforce the stored
signed-upload expiry. That left a source-backed negative-test requirement unproven. The completion path
now rejects a pending asset when `UploadExpiresAt` is absent or not in the future. The check occurs
before provider HEAD and before activation, so an expired authorization cannot promote an object.

No production/staging proof was invented to close this gap.

## Closure rule

This document may be changed from **CANDIDATE** to **TESTED / MERGED** only after the same final
documentation-inclusive implementation SHA passes Database CI, Backend CI, Frontend CI and Frontend E2E,
the latest legacy delta is reviewed, and the implementation PR is merged. A separate documentation
closure PR must then pass the same four gates before merge.

`PARITY_PROVEN` remains forbidden until the later release-evidence phases are complete.
