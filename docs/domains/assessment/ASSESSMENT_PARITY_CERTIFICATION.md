# Assessment Integrated Parity Certification

Status: **INTERNAL CERTIFICATION CANDIDATE**

## Source basis
Audited against read-only legacy commit `8724cd5081df75487e3207bf844e6db470fe0eda`, especially:
- `docs/assessment-users-roles-contract.md`
- `docs/assessment-platform-v1-handoff.md`
- `docs/assessment-system-code-audit.md`
- `scripts/live-assessment-mock-session-audit.mjs`
- `scripts/live-assessment-commercial-audit.mjs`

The legacy North Star explicitly separates Assessment Definition from Learning Placement, Directed Assignment and Session, makes the server the final permission authority, keeps Student as the taker and Parent as observer, and requires historical version/snapshot safety.

## V2 certification scope
The merged V2 Assessment domain already implements:
- definition/version authoring and immutable exact Question Bank version placements;
- staff workflow/publication;
- learner attempts, autosave/idempotent start+submit and server scoring;
- learner-owned result/review with answer/explanation policy secrecy;
- normalized Learning Placements;
- normalized public/barcode/live Sessions, including anonymous public isolation;
- normalized Directed Assignment backend with relational user/class audiences and server-owned learner filtering.

This certification adds the missing learner-facing Directed Assignment entry surface at `/assessment-assignments`. It consumes only `/api/v1/assessment-assignments/mine`, so the browser never receives a broad assignment inventory or decides school/class targeting. Starting a directed assignment remains CSRF-protected and enters the canonical Assessment Attempt runner.

## Ownership/security boundaries
- Question Bank owns question bodies/options/correct answer data.
- Assessment pins exact question versions and owns scoring/result policy.
- Organizations membership is authoritative for class/school audience checks.
- Content owns learning target validity for placements.
- Commerce owns paid entitlement decisions.
- Realtime owns Smart Classroom websocket/presence/reveal/projector state.
- Parent remains observer-only; no parent attempt flow is introduced.

## Legacy differences intentionally not copied
Legacy mixed directed targeting into Quiz documents and used browser/store compatibility state. V2 keeps distribution relational and server-authoritative. Legacy local timer/result fallback weaknesses documented in its own audit are not recreated; V2 attempt/session expiry and official result authority remain server-owned.

## Visual/E2E evidence target
The exact documentation-inclusive head must keep the existing Assessment desktop/mobile builder, attempt, result/review, placement, anonymous barcode and live-session journeys green and add a mobile directed-assignment journey plus a negative non-student inventory assertion.

Direct side-by-side legacy-runtime screenshots are external evidence. This document must not claim `PARITY_PROVEN` from deterministic V2 screenshots alone.

## Implementation checkpoint
Implementation head `5867c6879540152aa2897507be8fc3fbe9bbcd50` passed Frontend CI `36371918890` and Frontend E2E `36371918901` (64/64). Browser evidence artifact `10949631044`, digest `sha256:e2a41e753f365be13b7bf17aba2303758b6029b05592b766888ca2bc85353d89`.

Final same-domain legacy delta re-check found no newer legacy commit and reconfirmed the source-backed differences: legacy directed audience remains embedded in Quiz and is documented for Assignment migration; PublicBarcodeTest duplicates assessment/settings and is documented for Session migration; legacy QuizResult uses snapshot/submissionKey while V2 pins formal Assessment/question versions and server-owned results. No additional legacy behavior was copied because those differences are exactly the normalized V2 target direction.
