# Student learning write JSON integrity — 2026-10-30

## Authority and boundaries
- Legacy read-only main: `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go main baseline: `98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Implementation: Draft PR #231; RED-only evidence: Draft PR #232 (never merge).
- Existing student owners: #161 review media, #163 course player, #164 study plan UI, #168/#229 foundation and header, #224 lesson-progress HTTP. No files from these PRs changed.
- No scoring, payments, RBAC, schema, admin, schools, Legacy or production writes.

## Proven source-code gap
The Go student study-plan decoder used one `json.Decoder.Decode` call and did not check EOF. The same pattern existed in review-answer and mastery-goal writes. A request containing two JSON documents could be accepted as the first one, causing a misleading successful write. This is an HTTP request integrity issue, not a claim of visual parity with Legacy.

## Bounded correction
- Require one JSON object and EOF after optional whitespace before service invocation.
- Retain 64 KiB cap for study plans, 16 KiB for goals/review, unknown-field rejection, CSRF/auth and existing 400 response envelope.
- Cover POST/PATCH study plan, POST review answer, POST/PATCH mastery goals.
- The real HTTP route tests use deliberately unavailable service dependencies so a malformed request cannot reach persistence; the tests do not claim a successful PostgreSQL save/reload.

## Acceptance and outstanding evidence
| Gate | State | Evidence |
|---|---|---|
| RED behavior | PENDING | #232 test-only branch; distinguish behavior failures from formatter failures |
| GREEN Go HTTP | PENDING | #231 exact-head Backend CI |
| Database | PENDING | #231 Database CI (general migrations/integration, not this specific write) |
| Frontend | PENDING | #231 Frontend CI |
| Browser | PENDING | #231 Frontend E2E |
| Paired Legacy↔Go 390/820/1440 RTL | NOT PROVEN | Same-role/data runtime fixtures unavailable in this slice |
| Real Go→PostgreSQL successful study-plan save, back, reload | NOT PROVEN | Requires isolated authenticated student test and real PG assertion |
| Student foundation video/training/support parity | PARTIAL | #168/#229/#200 owners, not changed here |

No merge, deployment or cutover. The owner contract requires all open acceptance gates to remain visible until evidenced.
