# taxonomy

Paths, subjects and skill hierarchy.

Business logic belongs in this domain. Cross-domain access must use explicit contracts, not arbitrary table access.


## Presentation metadata

Taxonomy remains the owner of path/level/subject/skill identity and lifecycle. The original `presentation` JSONB columns on `paths` and `subjects` are created in migration `000001_platform_foundation`. Taxonomy remains their sole owner; these fields are not duplicated in Content or HomepageSettings:

- Path: `showInNavbar`, `showInHome`, and nested `settings` (`showSubjectCards`, `showMockExamCard`, `showPackageCard`, `studentTemplate`, `stageSelection`, `stageLabel`).
- Subject: `icon` and `color`.

Repository updates merge supplied keys into JSONB, including nested path settings, so omitted fields and unknown source-owned keys survive. Explicit `false` and empty `stageLabel` are preserved. Mutation and audit remain one transaction.

The public bootstrap exposes only active paths/levels/subjects. An optional authenticated platform-admin session receives the full lifecycle projection with `private, no-store`; teacher/supervisor inactive-path visibility is intentionally not widened until the canonical Content/Organizations scoped-navigation contract is available. Unsafe writes remain platform-admin-only and CSRF protected.
