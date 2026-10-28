# Public discovery

Source contract: `almeaacodax` main `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`,
`components/SearchModal.tsx` and `server/src/routes/search.routes.ts`.
This module coordinates bounded public metadata readers owned by Content and
Questionbank. It owns neither publication, organization membership, entitlements,
question correctness, nor destination access.

## HTTP boundaries

- `GET /api/v1/search?q=...&type=all|course|lesson|question&limit=1..20`:
  trimmed query1..120 UTF16 units, default type `all`, default limit20.
  Returns `{q,type,results:{courses:[],lessons:[],questions:[]}}`; rows contain
  `{id,title,subtitle,route,pathId,subjectId}` plus `sectionId:""` for lessons and
  questions because Go has no equivalent source section mapping. It does not
  fabricate counts. Routes retain `/course/:id` and original category queries.
- `GET /api/v1/public/articles?page=1&limit=1..100`:
  explicit pages, default page1/limit20, `{items,page,limit,hasMore}`. Rows contain
  `{id,title,description,pathId,subjectId,type,approvedAt?}`. `approvedAt` is canonical
  approval Unix milliseconds, omitted when unknown; it never substitutes creation
  time. The caller consumes successive pages rather than silently truncating.

Guests and signed-in users receive the same deliberately public preview data.
Destination authorization remains in its owning service. Neither endpoint writes
storage. The shared connection pool is the only repository factory dependency;
Content and Questionbank use their existing `postgres.New(db,audit)` factories.

## Privacy and source differences

Content's public readers require platform ownership, approved/visible content,
active subject/level and active path ancestry. Courses also require publication.
Lesson metadata/content matching requires an unlocked lesson and either a complete
active/visible/unlocked foundation-topic ancestry or an active module with an
explicit preview placement in an approved/published/visible platform course.
Locked, unplaced, paid non-preview and organization/trainer content never become
keyword inference channels. Public articles reuse precisely the same predicate,
selecting text lessons or other lessons with nonempty text content. Articles return
description only; source's content-body summary fallback remains omitted.

Questionbank's preview reader uses the canonical approved current version only,
platform ownership and active subject/level/path ancestry. It selects at most120
characters from storage, then enforces the source120 UTF16-unit title bound without
splitting Unicode characters. No options, correct answer, hint, explanation or
historical body is returned. Source's explanation keyword matching is deliberately
omitted because Go has no public explanation exposure policy and matches would
otherwise disclose protected explanations by inference. This public preview is
not an entitlement to retrieve a question or an assessment.

These predicates are stronger than legacy's broad approved-only lesson/question
query and exclude school/trainer rows even if a privileged actor opens search.
They do not claim complete search-result parity across private datasets.

## Evidence limits

Application/HTTP tests cover query validation, group selection, original routes,
empty arrays, canonical article dates and honest server failures. The dedicated
`TestPublicSearchHTTPPostgres` uses temporary copies of migrated tables to cover
publication/owner/visibility/lock/placement boundaries, literal LIKE metacharacters,
current question version, protected explanation inference, title previews,
archived scopes/ancestors and article pagination. It explicitly skips without
`DATABASE_URL`; passing non-database tests is not evidence those SQL assertions ran.

The React search transport tests use the real adapter/session with a substitute
network boundary for request shape, aborts, failures and stale responses. Rendered
markup comparisons cover original initial/loading/empty/result modal states;
they do not replace browser keyboard/navigation or paired visual evidence.
