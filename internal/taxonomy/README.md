# taxonomy

Paths, subjects and skill hierarchy.

Business logic belongs in this domain. Cross-domain access must use explicit contracts, not arbitrary table access.

### Navigation presentation

Path POST/PATCH accepts optional `showInNavbar`, `showInHome` and
`settings.showMockExamCard` booleans. `settings.stageSelection` accepts the source
options `auto`, `required`, `none`; `settings.stageLabel` is trimmed and must contain
1–120 characters when supplied. Subject POST/PATCH accepts optional
`icon` and `color` strings, including empty strings. These display fields live
in the existing JSONB `presentation` columns; PATCH merges only supplied fields
and preserves unrelated keys, including other path settings. The original source
accepts arbitrary icon/color strings (named palette colors, custom hex and emoji
are used by its controls), so the API does not add a new enum restriction.
Omitted path booleans remain omitted and consumers apply the original visible
unless explicitly false rule.

Public/admin bootstrap and path/subject mutation responses expose these fields
at the original top-level camelCase locations. `isActive` is projected from
canonical path `status`, and the existing status input remains its write API.
No presentation flag grants learning/content access. Existing admin permission,
CSRF checks, active scope filtering and atomic audit transactions remain in force.

PostgreSQL verification uses schema-local tables cloned from the migrated test
schema and never modifies existing rows. Run against an isolated migrated DB:

```sh
TAXONOMY_TEST_DB=1 DATABASE_URL="$DATABASE_URL" go test ./internal/taxonomy/repository/postgres -run TestDisplayPostgresSaveReloadAndAuditRollback -count=1 -v
```

The test verifies create/reload, false/empty/omitted values, preservation of
unrelated presentation/settings keys and rollback when the audit insert fails.
The frontend display editor retains unsaved values when a save fails. Full
source workspace parity and paired responsive screenshots are separate evidence.

Regular `/bootstrap` optionally authenticates an existing session. Authenticated
admin, teacher and supervisor roles receive the source staff structure (including
inactive/archived paths), with `Cache-Control: private, no-store`, `phase=full` and
`Vary: Cookie, Authorization`. All other roles, absent sessions and invalid or
expired sessions receive the active-only public projection. The source staff
queries have no active predicate or archive state; Go archive status projects as
`isActive=false`. These read permissions do not change AdminBootstrap or writes.
