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

## Completed certification checkpoint — Assessment
Assessment integrated parity certification is **TESTED / MERGED**. The learner Directed Assignment entry surface consumes only the server-scoped `assessment-assignments/mine` projection and enters the canonical Attempt runner. Final documentation-inclusive head `5f0f3db3d7f40a2659db47f8f85866f73d1383a1` passed Frontend CI `36372298444` and E2E `36372298458` (64/64), artifact `10949179677`; same-domain legacy delta re-check completed. PR #76 merged as `43e3c98491aad8ee5a0610ced69d751f7c51fa82`.

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

## Completed global release-certification checkpoint — Cross-domain golden journeys / negative-security sweep
PR #92 is **TESTED / MERGED**. Final documentation-inclusive implementation head `78e3137ef37d20b9198a7c36719b5ef52e4f7c48` passed Database `36448930041`, Backend `36448930062`, Frontend `36448930043`, and Frontend E2E `36448930059` (69/69). Browser artifact `10982112322`, digest `sha256:cbfbdd4b651cb690f201686919547755c48afc9cb397c525cf900295b7bef310`; squash merge `bc817995b94632adbda5c6572529003c90caf3bf`. Final legacy checkpoint `983b004d18818166bf97c9096411e2707551a0bd`. One source-backed gap was fixed: Media completion now rejects expired/missing signed-upload authorization before provider HEAD/activation.

## Completed global release-certification checkpoint — Dashboard visual parity / responsive polish
PR #95 is **TESTED / MERGED**. The public/general site was intentionally left unchanged; the batch focused on control-panel clarity and phone/tablet/desktop responsiveness. Final documentation-inclusive implementation head `a433317689e7b1d72a8c49c72efb6de959bf8556` passed Database `36456757788`, Backend `36456757826`, Frontend `36456757781`, and Frontend E2E `36456757889` (71/71). Browser artifact `10986680576`, digest `sha256:1c734174c2eb76d7eeaddbbf31f11b42d73ae2ccb500093a090ced068e7a87fc`; squash merge `02cbe52ee69f786b925c50284b4eb864ff2305f1`. Final legacy checkpoint `983b004d18818166bf97c9096411e2707551a0bd`. No auth, owner-domain, schema or public-site behavior was changed.

## Completed certification checkpoint — Public site + user workspace visual migration
PR #98 is **TESTED / MERGED**. It removes the visible `ALMEAA V2 / واجهة المنصة` placeholder and restores the source-backed public identity with local presentation media and real Tajawal 300–900 loading. Student, Supervisor and Admin root placeholders now expose role-guarded hubs over already-implemented V2 routes; public About/Contact/FAQ/Privacy/Terms and explicit 404 replace generic placeholder routing. Existing School Director, Parent and Teacher/Smart-Classroom screens are preserved.

Final documentation-inclusive head `6dc99794739d2e92c4804c4662265106c36ace47` passed Database CI `36548862250`, Backend CI `36548862299`, Frontend CI `36548862270`, and Frontend E2E `36548862300` (**76/76**). Browser artifact `11023742671`, digest `sha256:1a74e913ac7ef939df8e5f76a80bdb22d26fe2d2c78768d721d6d7c64d2d1fa5`; squash merge `1eec97776b27f22a77a6a9a743ea3a6be45000a4`. Final legacy re-check reached `4602952a6f68a61494227b945c3f534d7f36413a`; the delta is Question Bank counter/canonical-taxonomy hardening only and does not change this public/workspace contract. Runtime-managed HomepageSettings/PlatformFontSettings, external/staging provider proof, production load, restore and governance remain outside this closure.

## Next global release-certification batch — External / staging provider evidence
Verify only real externally observable evidence that internal CI cannot certify: configured provider connectivity/callback behavior, R2/CDN smoke where credentials exist, deployment release identity and live observability ingestion/alert path. Do not invent unavailable credentials or convert configuration into proof. Production-equivalent load/bandwidth, dated backup/restore/RPO-RTO and unresolved policy closure remain later independent gates.


## ACTIVE OVERRIDE — Exact Legacy UI Transplant

The previously listed next batch `External / staging provider evidence` is temporarily deferred until the owner-facing UI transplant is complete and accepted.

Authoritative plan:
`docs/visual-baseline/EXACT_LEGACY_UI_TRANSPLANT_PLAN.md`

Evidence baseline:
`docs/visual-baseline/exact-legacy-public-ui/`

Current active sequence:
1. UI-1 Shared visual foundation.
2. UI-2 Public landing exact transplant.
3. UI-3 Learning experience parity (**high priority; preserve the invested legacy learning UI**).
4. UI-4 Learner workspace.
5. UI-5 Teacher / Parent / School Director / Supervisor workspaces.
6. UI-6 Admin/control panels.
7. UI-7 Public/static/auth completeness.
8. UI-8 Cross-page visual certification and cleanup.
9. Resume External / Staging Provider Evidence only after owner-facing UI acceptance.

Execution invariant:
- Legacy UI/presentation is the visual source of truth.
- Existing V2 Go/PostgreSQL/Redis/domain contracts are the functional source of truth.
- Prefer frontend adapters/view-models over changing backend contracts.
- No redesign, no simplified reinterpretation, no CSS patch stack.
- Small accessibility/performance/responsive fixes are allowed only when the recognizable legacy interface remains unchanged.
- Any backend gap must be independently source-proven and documented before changing a domain contract.

Handoff requirement:
Every agent (ChatGPT, Codex, Gemini/Antigravity, or another agent) must read the authoritative plan plus CURRENT_STATE/PARITY_MATRIX/WORKING_SET before modifying code, and continue from the first incomplete UI phase rather than inventing a new order.


## Active Exact Legacy UI checkpoint — UI-1/UI-2 public transplant
PR #102 is active. The implementation is now based directly on the legacy frontend code rather than reinterpreting screenshots. Source files audited: `pages/Landing.tsx`, `components/Header.tsx`, `components/MainLayout.tsx`, `data/defaultArticles.ts`. PR #100 remains the geometry/screenshot baseline.

Pre-doc candidate `671ac48b76507bc204f0b9200e0f66021fffbe46` passed Frontend CI `36613429864` and E2E `36613429627` (76/76; artifact `11054736391`, digest `436ca62d619095a196b5c9dbe416dd51cf7e1a213aeb5937d7fd9604397c4c9a`). Current legacy re-check `b93923cfdb1cd5bcb9bbb51e35422d1f9d52b400` changes no public visual source.

Do not start a parallel redesign. Complete PR #102 on one exact documentation-inclusive SHA across all four gates, merge, create closure-doc PR, then start UI-3 Learning. Learning is the next high-priority protected interface and must be transplanted from its legacy source components over existing V2 Learning/Content APIs.


## Closed Exact Legacy UI checkpoint — UI-1/UI-2
PR #102 is **TESTED / MERGED**. Final docs-inclusive head `092e6031814311145fb8de94e2109bfef042bc8d` passed Database `36614045042`, Backend `36614044782`, Frontend `36614045115`, E2E `36614044693` (76/76). Artifact `11053883839`, digest `76a0c7184ba0192b7b906d07138005feecd1305c8916779545737372109c9515`; squash merge `9e60ec3fd2de52c07d999c6ffb51309035d0f4c9`. Legacy remained `b93923cfdb1cd5bcb9bbb51e35422d1f9d52b400`.

### Next active UI phase — UI-3 Learning experience parity
Do not redesign Learning. Read the legacy Learning source first, identify the exact route/component pair for each learner surface, and transplant presentation/interaction over canonical V2 Learning/Content APIs using frontend adapters. Priority surfaces begin with the legacy subject learning space and course/player journey, then review/results/study-plan/assessment learner flows. Preserve existing V2 server authorization, Commerce access authority, progress truth and assessment scoring.


## Active Exact Legacy UI checkpoint — UI-3 Learning

PR #104 is the active implementation batch.

Current first-slice state:
- Learning Space and Course Player legacy presentation transplant implemented over canonical V2 APIs.
- implementation head `36919c417574b48a2a80d57336ac79530e8d3822` passed Frontend CI `36624050679` and Frontend E2E `36624050812` (79/79).
- browser artifact `11058834343`, digest `sha256:047c7deb7f3c13faf0a401df472c1d9267242f062d1e4ee083dfc65d82f22423`.
- documentation-inclusive exact-head four-gate verification is now the merge gate.
- latest legacy must be re-checked before merge.

Do not reopen UI-1/UI-2.

After PR #104 closes, continue UI-3 from the first incomplete protected surface:
1. `/review`;
2. `/review/practice`;
3. `/plan`;
4. `/assessments`;
5. assessment results;
6. `/reports`.

All remain presentation-transplant work unless a separately proven source-backed backend gap is recorded.
