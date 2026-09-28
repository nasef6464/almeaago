# Current Working Set

## Current phase
Cross-domain parity / release certification.

## Foundation gate
GREEN.

## Completed certification checkpoints
- Identity/Auth internal parity — **TESTED** in PR #69.
- Organizations / Schools / Classes internal parity — **TESTED** in PR #70.
- Taxonomy internal parity — **TESTED** in PR #71.
- Question Bank / Media internal parity — **TESTED** in PR #72.

Question Bank / Media evidence in the current checkpoint:
- real responsive `/admin-dashboard/questions` staff workspace.
- bounded server-side filters and coverage; no browser-wide question inventory load.
- canonical Taxonomy path/subject/main-sub skill authoring.
- exact current-version review/workflow controls and no destructive delete UI.
- browser SHA-256 + presign + direct object PUT + server completion verification; Go never receives question image bytes.
- platform-admin V2 import surface remains dry-run-first and server-preflight authoritative.
- teacher UI omits admin-only import actions.
- final documentation-inclusive exact head `2a98ad4d4e09c8ed7de0ef1cf0c62a5934f4cf88` passed Database `36334351564`, Backend `36334351596`, Frontend `36334351571`, and Frontend E2E `36334351583` (61/61).
- final browser evidence artifact `10936483838`, digest `sha256:43e37c2ae7e81be630662d0b4c94a965e184c3aa92c247353e91edceb76e809a`; PR #72 merged as `d5c23a1ee856af77aac3e047ccb795622d1d0eb7`.
- deterministic Question Bank desktop and teacher-mobile screenshots.
- live R2/CDN deployment smoke and direct legacy-runtime side-by-side screenshot comparison remain external evidence; neither is treated as a CI pass.

## Next allowed code areas
Foundation learning / Content parity only, plus narrowly required shared test/documentation files:
- internal/content/**
- internal/learning/** only where the audited Foundation learning flow proves an owner-domain gap
- Content-owned migrations / queries only when an actual gap is proven
- apps/web Content/Foundation/Learning surfaces required by the parity audit
- targeted Content/Foundation E2E/visual evidence
- docs/domains/content/**
- docs/domains/learning/**
- docs/CURRENT_STATE.md
- docs/PARITY_MATRIX.md
- docs/WORKING_SET.md

## Guardrails
- Start Foundation learning / Content parity from current `main`; PR #72 is merged and its final documentation-inclusive exact head is green.
- `nasef6464/almeaacodax` remains read-only behavioral/visual reference.
- Taxonomy owns hierarchy IDs; Content stores references only.
- Question Bank owns question/version truth; Content does not embed question payloads.
- Media owns binary asset lifecycle; Content stores asset references only.
- Commerce owns entitlement/access truth; Content publication/visibility must not become a second purchase authority.
- Do not invent approved-content editing/versioning policy that remains explicitly unresolved.
- No production go-live claim from CI alone.

## Completed certification checkpoint
Foundation learning / Content integrated parity — **TESTED / MERGED** in PR #74. Final exact head `ddf8961c606b8f9d3184997cc655f6be2cf3bae5` passed Frontend CI `36371378688` and Frontend E2E `36371378748` (62/62), artifact `10949426615`; squash merge `2596e564854edf41e296998b0b641161d1d60a16`. Backend/database contracts were unchanged by this UI certification slice.

## Active certification batch
Assessment integrated parity certification is in progress: the missing learner Directed Assignment entry surface now consumes only the server-scoped `assessment-assignments/mine` projection and enters the canonical Attempt runner. Assessment integrated certification final documentation-inclusive head `5f0f3db3d7f40a2659db47f8f85866f73d1383a1` is green: Frontend CI `36372298444`, E2E `36372298458` (64/64), artifact `10949179677`; same-domain legacy delta re-check complete. Ready to merge PR #76.

Assessment certification PR #76 merged as `43e3c98491aad8ee5a0610ced69d751f7c51fa82`.

## Completed certification checkpoint — Review / Adaptive Learning
PR #78 is **TESTED / MERGED**. Final documentation-inclusive head `ba9d44fcd28fc2cfd3759a1a234261dd10e55f96` passed Database `36376123212`, Backend `36376123245`, Frontend `36376123259`, and Frontend E2E `36376123154` (64/64). Browser artifact `10951385237`, digest `sha256:a3a5d19fa8128f122855cb16b9a48e7a709eaaf4674e9ebafd0907d09763b3f7`; squash merge `c21874eeca576241c44fdd08507dfa87dae73121`. Legacy re-check reached `6927f7e6a05447862b4872c5203503fb7296e69c`; its FND26 taxonomy repair did not change Adaptive/Review behavior.

## Completed certification checkpoint — Commerce
PR #80 is **TESTED / MERGED**. Final documentation-inclusive head `01b8df818d74e7a6a0ee1ba647f1e11da6875dae` passed Database `36377437385`, Backend `36377437374`, Frontend `36377437343`, and Frontend E2E `36377437469` (65/65). Browser artifact `10951730943`, digest `sha256:5434e2ffa1df40bb8df4ba92d766fe7c249dcf248e244703b8f6e68ac9043667`; squash merge `de89512d4599f76ebc75365c9556fcbf94ee09d3`. Latest legacy re-check `20a77c62fd2db4ef891a574241f4cfd6946011de` changed Question Bank/Tahsili only. Live Tap proof, partial-refund/clawback policy and multi-trainer Package allocation remain explicit external/UNKNOWN boundaries.

## Completed certification checkpoint — Parents
PR #82 is **TESTED / MERGED**. Final documentation-inclusive head `33bddf91bdc5191c48b44443ec495964cc125985` passed Database `36384065061`, Backend `36384065062`, Frontend `36384065128`, and Frontend E2E `36384065117` (66/66). Browser artifact `10953663005`, digest `sha256:dd650171d5eb38a05445359acfdb9cd50085b904c0d2a3962de9e0eae8489cbe`; squash merge `08c5f6013568913b2693672875ec0be7eb684214`. Legacy re-check through `a5bcd4a1b43316d6dfc0c75e7f2d91a2e8d294e9` found no Parents authority/privacy delta. Communication-owned delivery/preferences remain separate.

## Completed certification checkpoint — Communication / Notifications
PR #84 is **TESTED / MERGED**. Final documentation-inclusive head `40b29eb12ea2412c86d0860cdbbce26bb4d65afe` passed Database `36387587378`, Backend `36387587330`, Frontend `36387587371`, and Frontend E2E `36387587337` (67/67). Browser artifact `10954888610`, digest `sha256:8a0bfeac1bf6f8d915ffe198a40e060ab4ef5693fa36fd4fbf5f5d6c3e0d693c`; squash merge `78f248272fc62dd6c951dad1e3f17c8ae3d5223c`. Latest legacy re-check `a5bcd4a1b43316d6dfc0c75e7f2d91a2e8d294e9` changed storage-hardening paths only and did not alter Communication behavior. Live providers, callbacks/read receipts, generic marketing consent/unsubscribe and retention remain explicit external/UNKNOWN boundaries.

## Completed certification checkpoint — Smart Classroom / Realtime
PR #86 is **TESTED / MERGED**. Final documentation-inclusive head `ffe9f4c31b02a9045e19ed833a25b956a743d3fd` passed Database `36398432788`, Backend `36398432977`, Frontend `36398432717`, and Frontend E2E `36398432819` (68/68). Browser artifact `10959556589`, digest `sha256:b0ac1d9eeab956a4c56c800ca6d4f5de071340dac598e732918ae2bbb091c5ff`; squash merge `398340eacbbefdc95d432d648a8d88b275b365a2`. The full legacy delta through `95e8cb7399431da481a0d69ef3420a16bbb8c66c` changes no Smart Classroom/Realtime file or contract. Mastery rollup remains deferred by source evidence; exact retention policy and production multi-instance/load proof remain external.

## Completed global release-certification checkpoint — AI integrated parity
PR #88 is **TESTED / MERGED**. Final documentation-inclusive head `7fbaa4b95d88fa8dda4b3187cb07b08d657a81fe` passed Database `36406617955`, Backend `36406617931`, Frontend `36406617939`, and Frontend E2E `36406617974` (68/68). Browser artifact `10961769319`, digest `sha256:91034c3d110c2b1690c7acfd2005381a223eb9f764f31afa6b7f561899b62747`; squash merge `93725f48f44149eb0a7fdec0e5dd16e4e4e23917`. Final closure re-check reached legacy `637a205e3c005602cd34ba6f729d6642796384ea`; its PLAN 6 student learning-loop delta changes no AI-domain file, so no AI same-domain delta remains unreviewed. Live provider certification, multi-key/quota-pool secret management, maintained pricing/cost, live Voice/Vision, Qiyas calibration, physical purge and production load remain explicit external/deferred evidence.

## Completed global release-certification checkpoint — Reporting / Operations integrated parity
PR #90 is **TESTED / MERGED**. Final documentation-inclusive head `70aaa214b628888613bcee30200c24f9080d5400` passed Database `36411507787`, Backend `36411507803`, Frontend `36411507801`, and Frontend E2E `36411507814` (68/68). Browser artifact `10964481531`, digest `sha256:3ec35b4f6b91cad7a27db5119aa70dea06383e7362fb34eb09b377081471d01a`; squash merge `2b84e69791db70fea36695674c9d1877c24691f8`. Final legacy re-check reached `851f28ec34504179cbbaf87f5e0642282c01b6d6`; its PLAN 7 delta changes AI certification evidence only and no Reporting / Operations contract. Dated restore/RPO-RTO, live Sentry/OTel, production-equivalent load, control-plane governance and independently verified deployment identity remain external.

## Active global release-certification batch — Cross-domain golden journeys / negative-security sweep
Start from current `main`. Exercise the Blueprint golden journeys across domain boundaries rather than isolated feature pages, then run an explicit negative/security sweep covering cross-school/cross-student, revoked/unassigned authority, answer-key leakage, direct unentitled URLs, duplicate/idempotent writes, invalid/expired media and role-safe realtime/provider surfaces. Add only source-backed hardening found by those journeys. Require the same documentation-inclusive Database/Backend/Frontend/E2E exact-head gate before merge; keep full visual parity, staging/provider proof, load/bandwidth, restore and policy closure as subsequent release-evidence phases.


## Active global release-certification batch — Cross-domain golden journeys / negative-security sweep (implementation candidate)
Branch `cert/global-golden-negative-sweep` is executing the Blueprint sweep from `main@444a1a5c60838d7c4f81c1acd9be2c7012c275bc`. New evidence includes a cross-domain learner golden journey, an expired signed-upload fail-closed fix with regression coverage, Question Bank invalid-taxonomy tests, and explicit DB idempotency invariant checks. Start-of-batch legacy is `983b004d18818166bf97c9096411e2707551a0bd`. Do not advance to full visual parity until the implementation exact head and independent documentation closure each pass Database/Backend/Frontend/E2E and the final legacy delta is reviewed. External/staging providers, load/bandwidth, dated restore and unresolved policy closure remain later gates.

## Completed global release-certification checkpoint — Cross-domain golden journeys / negative-security sweep
PR #92 is **TESTED / MERGED**. Final documentation-inclusive implementation head `78e3137ef37d20b9198a7c36719b5ef52e4f7c48` passed Database `36448930041`, Backend `36448930062`, Frontend `36448930043`, and Frontend E2E `36448930059` (69/69). Browser artifact `10982112322`, digest `sha256:cbfbdd4b651cb690f201686919547755c48afc9cb397c525cf900295b7bef310`; squash merge `bc817995b94632adbda5c6572529003c90caf3bf`. Final legacy checkpoint `983b004d18818166bf97c9096411e2707551a0bd`. One source-backed gap was fixed: Media completion now rejects expired/missing signed-upload authorization before provider HEAD/activation.

## Active global release-certification batch — Full visual parity
Start from the merged global security sweep on current `main`. Build deterministic route/viewport visual comparisons against the read-only legacy reference for critical Student, staff/admin, School, Parent, Commerce, Smart Classroom, AI, Reporting and Operations surfaces. Fix only evidenced layout/UX parity gaps without changing owner-domain contracts. Require the same final documentation-inclusive Database/Backend/Frontend/E2E exact-head gate and independent documentation closure. Live staging/provider proof, production-equivalent load/bandwidth, dated backup/restore, unresolved policy closure and final release certification remain subsequent phases.
