# Learner navigation preferences

Presentation-only self-selection, owned by learning. These records never create
entitlements, enrollments in paid courses, audience assignments, or access grants.
Existing content APIs remain authoritative for every content request.

Wire the exact route `/api/v1/learning/navigation-preferences` using:

```go
navigation.NewHandler(navigation.NewService(navigation.NewPostgres(pool)), identityService)
```

GET/PATCH require the existing session authenticator; PATCH additionally requires
its CSRF check. The actor comes exclusively from that session. The transport
response is `{user:{id,enrolledPaths,pathStageSelections}}`. PATCH accepts only
`enrolledPaths?:string[]` and `pathStageSelections?:{pathId,levelId}[]`.

Source contract: `contexts/StudentExperienceContext.tsx`,
`utils/studentPathScope.ts`, `components/studentPaths/*`,
`store/slices/pathEnrollmentActions.ts`, and
`server/src/modules/auth/application/studentPathPreferences.ts` in the pinned
read-only legacy tree. Explicit enrolledPaths replaces and prunes stages for
removed paths; omitted preserves. Stage rows merge by path, so an empty stage
array preserves existing rows. Null/false are invalid collection values. New
student choices honor available path and stage policy. Existing choices do not
force stage backfill. Writes serialize on the actor's user row, update ordered
normalized FK records and append audit in one transaction.

Frontend exports live in `features/learning/navigation/index.ts`. Mount
StudentNavigationProvider inside the existing auth and router providers. Original
bar/dialog/prompt markup is reused with transport adapters; the context exposes
catalog, saved settings, user, preferences, and original scope helpers. Session
switches invalidate pending loads, saves, selection and dialogs. Failed saves
retain dialog drafts. Initial preference-read failure blocks writes to avoid
silently replacing unknown saved preferences.

Tests:

- `go test -race ./internal/learning/navigation`
- `node --test apps/web/src/features/learning/navigation/studentPathScope.test.mjs`
- `NAVIGATION_TEST_DB=1 DATABASE_URL=<isolated> go test -v ./internal/learning/navigation -run TestPostgres`

The integration test uses a unique schema, copies canonical base tables, applies
actual migration 000046, exercises save/reload, actor isolation, foreign-level
application/FK rejection, and injected audit-failure rollback. It does not write
existing user data.

Limitations: source orphan preferences for deleted paths/levels cannot be imported
unchanged into these normalized FK records. No such import is implemented. Full
browser actor-switch/failure/viewport proof and route integration are outside this
package's isolated evidence. Go's inactive/archived level status has no direct legacy counterpart. New
choices use active candidate levels consistently with the public catalog; existing
saved inactive stage records remain roundtrippable without forced backfill.
