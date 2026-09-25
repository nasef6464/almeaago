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
| Assessment | assessment | definition/version API merged; staff builder implemented/tested in PR #43; learner execution remains later | admin/teacher scope, CSRF, workflow, publication and exact teacher taxonomy gating tested | normalized schema tested; builder references exact question versions and bounded canonical APIs | responsive staff desktop/mobile checkpoint green | Frontend CI + E2E green on PR #43 implementation checkpoint; final exact-head closure pending | IN_PROGRESS |
| Review/Adaptive | learning | pending | pending | pending | pending | pending | NOT_STARTED |
| Commerce | commerce | pending | pending | entitlement seed only | pending | pending | NOT_STARTED |
| Parents | parents | pending | pending | relationship seed only | pending | pending | NOT_STARTED |
| Smart Classroom | realtime | pending | pending | pending | pending | pending | NOT_STARTED |
| AI | ai | pending | pending | pending | pending | pending | NOT_STARTED |
| Reporting/Operations | reporting/operations | pending | pending | pending | pending | pending | NOT_STARTED |

No row becomes PARITY_PROVEN without evidence.
