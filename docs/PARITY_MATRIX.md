# ALMEAA V2 — Parity Matrix

Status values: NOT_STARTED · DISCOVERED · SPECIFIED · IN_PROGRESS · IMPLEMENTED · TESTED · PARITY_PROVEN · BLOCKED · INTENTIONALLY_CHANGED.

| Capability | Domain | Functional | Role/Scope | Data | Visual | E2E | Status |
|---|---|---|---|---|---|---|---|
| Platform foundation | platform | yes | n/a | migrations verified | shell only | CI | TESTED |
| Identity/Auth | identity | core/recovery/providers/self-profile implemented; admin lifecycle + normalized school/class/parent scopes implemented | session/CSRF/lockout/OTP/admin guards; teacher/supervisor directory uses legacy-compatible school/class scope | normalized identity/session/recovery/provider/OTP/admin-audit + organization relationships | auth/OTP UI build-tested; screenshot gate pending | admin Backend/Database gate pending; live provider smoke pending | IN_PROGRESS |
| Schools/Classes | organizations | core school/class/roster/teacher workspace + director compatibility implemented | membership/director/teacher/parent authority guards tested | normalized organization relations + read indexes | legacy-compatible director adapters present; full screenshot parity pending | Backend/Database checkpoints green | TESTED |
| Taxonomy | taxonomy | public bootstrap + admin mutations implemented | platform-admin mutation guards; active hierarchy validation | normalized path/level/subject/skill hierarchy | dedicated admin visual parity pending | Backend/Database checkpoints green | TESTED |
| Foundation learning | content/learning | Course/Lesson/Foundation/Library management + learner-safe projections implemented | admin/teacher combined scope + CSRF/workflow guards tested | normalized Content relations/composition + publication | representative admin desktop/mobile visual checkpoint green | Content Playwright 4/4 + Frontend CI green | TESTED |
| Question Bank | questionbank/media | versioned authoring/filter/coverage/import + Media direct-upload foundation implemented | staff scope/workflow/import guards tested | normalized question/version/skill/media/import provenance | dedicated Question Bank visual parity pending | Backend/Database checkpoints green | TESTED |
| Assessment | assessment | definition/version API + staff builder + learner attempts + directed assignments + result/review + learning placements + public/barcode/live Session distribution tested/merged | staff scope plus student-only attempt/result/placement/live ownership, anonymous public isolation, CSRF writes, idempotency, expiry, server scoring and review secrecy tested | exact published/question versions; relational assignment/placement/session contexts; normalized anonymous public attempts/answers/results; no copied question/content payload state | staff responsive parity plus learner mobile attempt/result/review/placement/session and anonymous barcode checkpoints green | PR #48 exact-head Database + Backend + Frontend + E2E green; merged as c67f848b7495c240b9daf7b36f712c14940f89ef | TESTED |
| Review/Adaptive | learning | pending | pending | pending | pending | pending | NOT_STARTED |
| Commerce | commerce | pending | pending | entitlement seed only | pending | pending | NOT_STARTED |
| Parents | parents | pending | pending | relationship seed only | pending | pending | NOT_STARTED |
| Smart Classroom | realtime | pending | pending | pending | pending | pending | NOT_STARTED |
| AI | ai | pending | pending | pending | pending | pending | NOT_STARTED |
| Reporting/Operations | reporting/operations | pending | pending | pending | pending | pending | NOT_STARTED |

No row becomes PARITY_PROVEN without evidence.
