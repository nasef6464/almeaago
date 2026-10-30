# Admin taxonomy Arabic text acceptance — focused parity checkpoint (2026-10-30)

## Source and ownership
- Read-only Legacy main: `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `server/src/models/Skill.ts` and `server/src/routes/taxonomy.routes.ts`. Skill and embedded sub-skill names are trimmed Unicode strings; the referenced schemas do not specify an 80-Arabic-character byte limit.
- Go main at branch start: `98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Independent implementation owner: `internal/taxonomy/application/service.go` and a new application regression test. Does **not** edit `#160` SkillsAdminPage/TaxonomyAdminPage, `#206` browser RED tests, header, student, schools, RBAC, scoring, payments or PostgreSQL schema.

## Reproduced source-level gap and safe fix
The Go service previously used `len(name)` / `len(description)` (UTF-8 byte counts) to enforce its 160-name / 4000-description limits. For example, `strings.Repeat("م", 160)` is 160 Arabic letters but 320 UTF-8 bytes, so a valid Arabic-length input was rejected **before reaching the repository**. This impacts admin create/update for path, level, subject and skill, and path/skill descriptions.

The focused fix uses `utf8.RuneCountInString` for name and description validation. It retains the Go 160/4000 numeric limits, trimming, status validation, CSRF, authorization, stable codes and repository calls. No additional UI element is introduced.

## Regression coverage
`go test ./internal/taxonomy/application -run 'TestAdminTaxonomyArabic' -count=1 -v` exercises:
- 160 Arabic letters accepted and 161 rejected on four creates and four updates (16 subtests).
- 4000 Arabic letters accepted and 4001 rejected on two creates and two updates (8 subtests).
- Teacher remains forbidden to create a skill (1 assertion).

## Limits and follow-up
- This closes **only** the erroneous UTF-8 byte/Arabic-character boundary in the Go application. Legacy has no corresponding 160/4000 cap in the cited skill schema; parity above these Go limits remains **UNKNOWN/NOT PROVEN**, pending explicit contract and database/UI validation.
- This test uses an in-memory repository stub, not a real HTTP session or PostgreSQL transaction. No claim of end-to-end or visual parity; paired 390/820/1440 RTL screenshots remain missing.
- Next owner action: #160 must make admin create/edit preserve drafts after HTTP 503 (#199), restore the original six Skills Center counters and controls (#206), then prove save/reload and student visibility through the existing Go API and isolated PostgreSQL. Do not reimplement lesson linking in #160.
- Four CI gates on the exact final SHA must be recorded independently. A non-triggered gate is **NOT RUN**, not PASS. No merge or deployment authorized.
