# Parents Integrated Parity Certification

Status: **CERTIFICATION CANDIDATE**

## Source basis
Audited against latest legacy checkpoint `20a77c62fd2db4ef891a574241f4cfd6946011de`, especially canonical parent authority and the parent Dashboard follow-up presentation, plus the target Parents blueprint/audit.

## Existing trusted foundation
The merged Parents domain already provides:
- canonical active Organizations parent -> student authority.
- privacy-safe child identity.
- bounded Assessment result summaries without answers, answer keys or review payload.
- current Learning weak skills and deterministic `recommendedAction`.
- read-only seven-day report.
- explicit no-linked-child state.
- denial of unlinked child reads before source-domain access.

## Certification correction — calm follow-up without a second recommendation engine
Legacy presents a short ordered follow-up plan for parents. V2 previously showed priority skill cards, but did not make their sequence or observer boundary explicit.

This batch:
- labels the parent experience as read-only/observer-only.
- turns the existing top-three weakest canonical Learning projections into an ordered follow-up plan.
- displays each skill's evidence count and last evidence date.
- reuses the exact Learning-owned `recommendedAction`; no parent/frontend advice engine is introduced.
- displays the actual weekly-report start/end window supplied by the server.
- adds responsive desktop evidence alongside the existing mobile golden journey.
- adds a negative browser assertion that the Parents UI sends no non-GET request to the Parents API.

## Privacy / ownership
- Organizations remains authoritative for active parent-child relationships.
- Identity supplies only safe profile fields after authorization.
- Assessment owns result truth; Parents never receives answer-level/correct-option data.
- Learning owns mastery/weak-skill/recommendation truth.
- Parents orchestrates read-only DTOs only.
- Communication owns email/WhatsApp delivery, preferences, consent and scheduling.

## Explicit non-goals
No self-service linking/consent flow, parent payment approval, student-learning mutation, Assessment attempt action, or Communication delivery policy is invented in this certification.

## Closure gate
The final documentation-inclusive head must pass Database CI, Backend CI, Frontend CI and Frontend E2E on the same SHA. Status remains TESTED rather than PARITY_PROVEN without direct legacy-runtime visual/external evidence.

## Local copy-ready weekly summary
Legacy product notes explicitly call for a parent summary that is easy to copy/share. The certification adds a local clipboard action to the weekly report. The text is built only from the already-authorized weekly DTO: period, assessment count, average score, weak-skill labels/mastery and the Learning-owned next action. It contains no email/phone/answer-level data and triggers no Parents mutation or external delivery request. Communication still owns automated email/WhatsApp delivery and consent/preferences.

## Latest legacy delta re-check
Legacy advanced to `a5bcd4a1b43316d6dfc0c75e7f2d91a2e8d294e9` with PLAN 4 storage hardening. The changed runtime paths normalize LessonProgress and immutable QuestionRevision and adjust `auth/me` progress projection; canonical parent relationship authority, parent-result privacy and parent write boundaries are unchanged. No new Parents behavior is copied from this delta.
