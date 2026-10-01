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


## Closed UI-3 checkpoint — Learning Space + Course Player

PR #104 is **TESTED / MERGED**.
- final implementation head: `9429a08e53b0709eb0eda4916759628db4605cb4`;
- Database `36624605777`: PASS;
- Backend `36624605736`: PASS;
- Frontend `36624605743`: PASS;
- E2E `36624605925`: PASS 79/79;
- artifact `11059419668`, digest `sha256:640f0c1fd3a32d9cd693320f6a85a741fe0c8856c72daadfe2c820b1a97282c0`;
- merge: `b7d0ec811f4ddf5cb8547572b2ccfdda3bc1308c`;
- final legacy re-check: `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`.

### Next active UI-3 surface
Continue directly with `/review` using the exact legacy review components and interaction model over the current V2 Review/Learning/Assessment APIs. Do not reopen the Learning Space/Course Player slice unless a regression is proven.


## Active UI-3 checkpoint — Review Library

PR #106 is the active `/review` transplant batch.

Protected legacy source:
- `pages/Favorites.tsx` at legacy `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`.

Pre-documentation implementation evidence:
- head `6f97c071444dea524018864b3984060097c2ffe3`;
- Frontend CI `36626299723`: PASS;
- Frontend E2E `36626299755`: PASS 80/80;
- artifact `11060292454`, digest `sha256:500cb9ef0cf8b6922f21d6b65bc22181918b1c823802ec4fef309d12c039b405`.

Merge gate now: exact documentation-inclusive four-gate verification, then latest legacy re-check.

Do not reopen the merged Learning Space/Course Player slice. After this Review Library slice closes, continue UI-3 directly with `/review/practice`.


## Closed UI-3 checkpoint — Review Library

PR #106 is **TESTED / MERGED**. Final documentation-inclusive head `2dd5003556d6ee4869003b24cf8e325deb8bd09c` passed Database `36626689392`, Backend `36626689362`, Frontend `36626689390`, and Frontend E2E `36626689383`; squash merge `1699665703b29837704492a5136861da44d80d16`. Final legacy re-check: `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`.

## Active UI-3 checkpoint — Review Practice

PR #107 is active from merged #106. Protected legacy source: `pages/ReviewSession.tsx` at `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`. Presentation transplant is implemented over the canonical V2 practice/answer contract; backend authority and answer secrecy are unchanged. Merge gate: exact documentation-inclusive Database + Backend + Frontend + Frontend E2E green on one SHA, latest legacy re-check, then merge. After closure continue directly to `/plan`.


## Closed UI-3 checkpoint — Review Practice

PR #107 is **TESTED / MERGED**. Final exact head `48b0ebe9d7bf9a32436281ab1b07eb3dd98f1ef9` passed Database `36673735488`, Backend `36673735457`, Frontend `36673735543`, Frontend E2E `36673735402`; squash merge `5f565454ddd34868d18391951a4a59a7838bf109`. Final legacy re-check: `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`.

## Active UI-3 checkpoint — Study Plan

Branch `feat/exact-legacy-study-plan-parity` starts from merged #107. Protected source: `pages/Plan.tsx` at legacy `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`. Presentation transplant is implemented over current V2 Study Plan authority. Merge gate: exact documentation-inclusive Database + Backend + Frontend + Frontend E2E green on one SHA, latest legacy re-check, then merge. After closure continue directly to learner `/assessments`, assessment results, then `/reports`.


## Closed UI-3 checkpoint — Study Plan

PR #108 is **TESTED / MERGED**. Final exact head `a0758e224f0d5cca1456aa1f04b196f4e1dbc6fb` passed Database `36694901842`, Backend `36694901668`, Frontend `36694901654`, Frontend E2E `36694901748`; squash merge `867b72db2182d3313ac516281ea1154a1ee8098d`. Final legacy re-check: `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`.

## Active UI-3 checkpoint — Learner Assessments

Branch `feat/exact-legacy-learner-assessments-parity` starts from merged #108. Protected source: `pages/Quizzes.tsx` at legacy `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`. Presentation transplant is implemented over canonical Assessment placement/attempt authority. Merge gate: exact documentation-inclusive Database + Backend + Frontend + Frontend E2E green on one SHA, latest legacy re-check, then merge. After closure continue directly to assessment results, then `/reports`.


## Closed UI-3 checkpoint — Learner Assessments

PR #109 is **TESTED / MERGED**. Final exact head `af4e1c6b37873d5761e21d0ea098bbc814c714e2` passed Database `36695589159`, Backend `36695589131`, Frontend `36695589156`, Frontend E2E `36695589219`; squash merge `c5a4c0c1d835fae31aa6c479c3b6ab37e9ef74b9`. Final legacy re-check: `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`.

## Active UI-3 checkpoint — Assessment Results

Branch `feat/exact-legacy-assessment-results-parity` starts from merged #109. Protected source: `pages/Results.tsx` at legacy `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`. Presentation transplant is implemented over canonical V2 result/review authority. Merge gate: exact documentation-inclusive Database + Backend + Frontend + Frontend E2E green on one SHA, latest legacy re-check, then merge. After closure continue directly to `/reports`.


Assessment Results pre-merge legacy re-check: latest legacy is `77761835d464687283f7ca9d65f43799ccd43962`. Its Results delta only replaces client-side skill recommendation heuristics with the canonical Reports recommendation view-model. Current V2 Assessment Results exposes no equivalent browser-owned recommendation resolver, so the active #110 implementation needs no authority change. Use `77761835d464687283f7ca9d65f43799ccd43962` as the final legacy checkpoint for this slice.


## Closed UI-3 checkpoint — Assessment Results

PR #110 is **TESTED / MERGED**. Final documentation-inclusive head `a8968499b5742e6f8fd0b75a19a77ecf55deda80` passed Database `36696586582`, Backend `36696586571`, Frontend `36696586523`, Frontend E2E `36696586862`; squash merge `c7f38824caec537d0903f6a732af378b321e52fa`. Final legacy re-check: `77761835d464687283f7ca9d65f43799ccd43962`.

## Active UI-3 checkpoint — Learner Reports

Branch `feat/exact-legacy-learner-reports-parity` starts from merged #110. Protected legacy source is `pages/Reports.tsx` and latest Reports view-models at `77761835d464687283f7ca9d65f43799ccd43962`. Student-only presentation transplant is implemented over canonical V2 Reporting APIs; staff/admin view remains unchanged. Latest legacy explicitly removed subskill recommendation heuristics, so this slice must not invent browser-owned Foundation routing. Merge gate: exact documentation-inclusive Database + Backend + Frontend + Frontend E2E green on one SHA, final latest-legacy re-check, then merge. This is the final listed UI-3 protected surface; after closure read the authoritative working set before entering the next UI phase.


Learner Reports final legacy re-check: latest legacy is `db0c09da042f8ef3ef76b5b1baa298042799e0d4`. The delta after protected Reports source `77761835...` changes only MASTER_CONTROL documentation and contains no Reports code. PR #111 may proceed through its final exact-head four-gate merge check without an additional code transplant.


## Closed UI-3 checkpoint — Learner Reports

PR #111 is **TESTED / MERGED**. Final documentation-inclusive head `63d85620381fe0295372b44341289f74f1022355` passed Database `36760136582`, Backend `36760136661`, Frontend `36760136488`, and Frontend E2E `36760136494`; squash merge `f8b48cbef6572727aca5cb8d63988b48f19ff6e4`. Final latest-legacy checkpoint: `db0c09da042f8ef3ef76b5b1baa298042799e0d4`. The post-`777618...` legacy delta was MASTER_CONTROL documentation only and did not change Reports code.

## UI-3 Learning Experience Parity — CLOSED

Protected learner surfaces completed and merged in sequence:
1. Learning Space + Course Player — PR #104;
2. Review Library — PR #106;
3. Review Practice — PR #107;
4. Study Plan — PR #108;
5. learner Assessments — PR #109;
6. Assessment Results — PR #110;
7. learner Reports — PR #111.

Do not reopen these slices unless a real regression is demonstrated. The next incomplete phase from the authoritative transplant plan is **UI-4 — Learner workspace**. Start with the student dashboard and its navigation, then learner notifications/reporting entry states, while preserving V2 data truth and matching the exact legacy source-backed layout/density.


## UI-3 closure record — MERGED

PR #112 is **TESTED / MERGED**. Documentation head `da4322ae8480201b0579c90ca5cced158947e284` passed Database `36760929429`, Backend `36760929116`, Frontend `36760929211`, Frontend E2E `36760929207`; squash merge `347201c87fb73e380e7de7f9b059df991ed30ab7`.

## Active UI-4 checkpoint — Student Dashboard + learner navigation

Branch `feat/exact-legacy-student-dashboard-parity` starts from merged UI-3 closure. Protected source: `pages/Dashboard.tsx` at legacy `db0c09da042f8ef3ef76b5b1baa298042799e0d4` (student menu/sidebar + `OverviewTab`). Candidate restores the exact legacy workspace hierarchy over real V2 routes only. Missing legacy-only tabs are not fabricated. Merge gate: exact documentation-inclusive Database + Backend + Frontend + Frontend E2E green on one SHA, latest legacy re-check, then merge. After closure continue UI-4 with learner notification/reporting entry-state parity that is not already covered by this dashboard slice.


## Active UI-4 checkpoint — Learner notification entry states

Student Dashboard PR #113 is merged at `ce2cf0482b97af5c24b88f87e48b0b83d04739c6`. Active branch `feat/ui4-learner-notification-entry-parity` protects `/notifications`. Exact latest legacy `components/NotificationBell.tsx` was read first. V2 inbox/unread/SSE/CSRF authority remains canonical; this slice restores only learner-facing entry-state vocabulary/density and responsive evidence. Merge gate: one documentation-inclusive SHA green on Database + Backend + Frontend + Frontend E2E, final legacy re-check, then merge.


## UI-4 closure candidate
Student Dashboard PR #113 is merged. Learner Notifications PR #114 final head `e9609de9a356f9e0bd5a3d36f9d39c282466b9aa` passed the four exact-head gates and squash-merged as `6dc78ced2b56ffeb8cba0a4ae9c244614dac0a5c`. Learner Reports content remains closed under UI-3 PR #111; do not reopen it. The closure branch adds only the missing responsive dashboard→`/reports` entry-state journey plus closure documentation. Once its exact documentation-inclusive head passes Database + Backend + Frontend + Frontend E2E and merges, UI-4 is CLOSED and the first incomplete phase is UI-5 Teacher → Parent → School Director → Supervisor.


## Active UI-5 checkpoint — Teacher
UI-4 is CLOSED via PR #115. Branch `feat/ui5-teacher-workspace-parity` starts from merge `ee15f91a2eb3f8d1c1b70371389c4983fd2128e7`. Protected source: latest legacy `dashboards/SchoolTeacherDashboard.tsx`. The V2 root previously jumped directly to Smart Classroom; candidate restores the teacher role-workspace shell while retaining canonical owner-domain destinations. Merge gate: exact documentation-inclusive four-gate green, latest legacy re-check, merge/read-back. Then continue UI-5 Parent → School Director → Supervisor.


## Active UI-5 checkpoint — Parent
Teacher PR #116 is merged at `3775b4a6b32eb4d9806d6fb57e4c963dc8d932fc`. Parent is active. Latest legacy `pages/Dashboard.tsx` shows the simple follow-up shell plus grouped follow-up/account entries and legacy WhatsApp/approval actions. V2 already has stronger canonical Parents read models; candidate restores only source-backed presentation/entries and routes digest/account state to existing owner surfaces. Do not invent legacy approval/send mutations. Merge only after exact-head four-gate green + latest legacy re-check, then continue School Director → Supervisor.


## Active UI-5 checkpoint — School Director
Parent PR #117 merged as `f6bf96186ed384c5fa59b2eff5e1dbe6b1fd1ed9`. Director V2 is already close to exact Legacy and is not blindly rewritten. Candidate restores only the missing academic operations entry hierarchy over the existing permission/module-gated, CSRF-backed Organizations workspace. Exact-head four-gate + latest legacy re-check required, then Supervisor.


## Active UI-5 checkpoint — Supervisor
School Director PR #118 is merged as `66641b11b5c27d4e18d780e8e6654d9eb4cb35dd`. Supervisor is the final UI-5 role slice. Exact legacy source exposes seven operational sections; V2 previously exposed only contexts/shortcuts. Candidate restores the hierarchy using Organizations context facts only, links canonical Reporting/Interventions, and marks unsupported live/test monitoring owner flows unavailable rather than inventing data. Merge only after one exact-head four-gate green + final Legacy re-check. Then close UI-5 and advance UI-6 Admin.


## UI-5 closure candidate
Teacher (#116), Parent (#117), School Director (#118) and Supervisor (#119) are merged. Latest legacy checkpoint remains `d4e5c831b632447e8b25009ffc17fee2076c67e5`. Do not reopen these role slices without a proven regression. This documentation closure must pass the exact-head four-gate rule; once merged, mark UI-5 CLOSED and advance directly to UI-6 Admin.
