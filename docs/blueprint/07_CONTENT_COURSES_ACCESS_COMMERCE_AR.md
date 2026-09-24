# 07 — Content, Courses, Access, Packages & Commerce

## 1. Content hierarchy

Core taxonomy:
- Path.
- Level where applicable.
- Subject.
- Section/Main Skill.
- Skill/Subskill.
- Topic/Foundation tree.
- Course.
- Lesson.
- Library item.
- Assessment.

## 2. Paths/Subjects

Path supports presentation settings:
- name/color/icon.
- navbar/home visibility.
- active.
- parent path.
- description/settings.

Subject scoped by path/level.

Target keeps presentation metadata separate from academic identity where possible.

## 3. Lesson

Current lesson supports:
- title/description.
- path/subject/section.
- type.
- duration/content.
- video URL/source.
- interactive questions.
- file.
- meeting URL/date.
- recording.
- visibility.
- linked quiz.
- order/lock.
- skillIds.
- owner/workflow.
- school/class live context.

Target splits asset and progress relationships; Lesson remains canonical content unit.

## 4. Foundation vs Course

Foundation:
- skill/topic-driven.
- short remediation/teaching path.

Course:
- module/lesson program.
- can be separately sold.

Do not merge them because they appear in same Student Learning Space.

## 5. Library

Files/support resources linked to:
- path/subject/section/topic/skill as applicable.
- visibility/access.
- course/foundation placement where required.

Binary file must live object storage, DB stores metadata/URL.

## 6. Content Workflow

For teacher/trainer-owned content:
- draft.
- pending_review.
- approved/rejected.
- Admin review queue.
- reviewer notes.
- publication separate from ownership.

Editing approved content may return it to review according policy.

## 7. Package vs Course

Verified product rule:

**Course = independent sellable product.**
**Package = bundle/entitlement scope.**

Never send a course to API as package or vice versa.

Package can grant:
- courses.
- foundation.
- question banks.
- tests.
- library.
- path/subject scope.

## 8. Access Resolution

Do not determine access only from UI or user arrays.

Target access resolver:

```
IsPublic/Free?
 OR
Active Entitlement for user
 OR
School Contract + Seat/Grant
 OR
Authorized special/public session
```

Return reason/source for audit.

## 9. AccessGrant ledger

Every paid/free/manual/code/school grant must have:
- source.
- subject user.
- resource scope.
- status.
- timestamps.
- idempotency key.
- revoke/expiry.

## 10. Payment request

Current PaymentRequest captures:
- user.
- item type/id/name.
- package/course content scope.
- original/discount/final amount.
- currency.
- payment method.
- status.
- receipt/reference.
- provider/gateway mode/country.
- transaction/event IDs.
- reviewer/audit.

## 11. Payment modes

- manual_review.
- payment_link.
- webhook.

Auto access only after trusted server confirmation.
Webhook:
- signature verification.
- idempotent event guard.
- atomic status transition.
- grant created once.

## 12. Discount

Preview/validation server-side.
Scope to eligible product type.
Do not trust price sent by client.

## 13. Cart/Checkout

UI is not authority:
- server re-resolves item, current price, access, discount.
- repeated submit idempotent.
- pending request cannot create duplicate grants.

## 14. School commerce

School contract/package:
- seat cap.
- enabled modules.
- content scope.
- validity.
- school-level entitlements.

Student learning access derives from active contract/grant + membership/class where needed.

## 15. Revenue sharing

Fields موجودة لبعض trainer-owned content.
Target finance model should separate:
- gross sale.
- provider fee.
- discount.
- platform share.
- trainer share.
- payout status.
No estimated revenue shown as fact without source ledger.

## 16. Growth

- payment list paginated.
- finance exports background jobs.
- event ledger append-only.
- no giant transaction arrays on user.
- no raw receipt binaries in DB.
