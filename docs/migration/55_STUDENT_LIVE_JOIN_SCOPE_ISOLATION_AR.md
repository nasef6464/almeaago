# Student live join — URL-scoped verification and stale-action isolation

**Legacy reference:** `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` (read only). **Go base:** `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.

## Functional slice

Actor: authenticated student. UI: `/live-assessment?code=...` → GET `/api/v1/assessment-sessions/join/:code` → server-provided session → POST `/api/v1/assessment-sessions/:sessionId/start` with CSRF and stable idempotency key → attempt runner. The Go HTTP/application/PostgreSQL implementation is unchanged in this PR; existing server checks remain authoritative.

The previous Go page retained a verified session for code A after navigation to code B. When B's GET failed, the A card and its start action remained visible, allowing the student to start the wrong session. It also initialized the input from the URL only once, so browser Back could show a different code from the URL. This is a code-inspection finding, not a certification of the full Legacy presentation.

## Minimal correction

- Bind the displayed verified session to the current URL code and clear it immediately on verification of another code.
- Clear old state while a new lookup is pending and on failed lookup; abort old requests on scope change.
- Synchronize the code field with URL history; permit retrying the same code after a failed GET.
- Guard start against busy/non-startable/stale sessions; keep the existing idempotency key and server authorization.
- Do not add or rearrange any UI elements; do not touch #161, #163, #168, #203 or any scoring, RBAC, payment, admin, school or database code.

## Acceptance and evidence boundaries

Nine browser cases (three behaviors × 390/820/1440 RTL): failed B cannot expose A; pending B cannot expose A and starts B only after confirmation; browser Back restores A. Run with `cd apps/web && npx playwright test tests/e2e/student-live-join-scope-isolation.spec.ts`. The exact-head four CI gates and RED→GREEN run links belong in PR conversation after completion.

**PARTIAL** for the end-to-end student journey: browser requests are mocked. No paired Legacy↔Go screenshots with identical live accounts/data, nor a new real Go/PostgreSQL session trace. Those require a seeded isolated integration environment. No merge/deploy/cutover is authorized.
