# Public mock assessment summaries

Mount `NewHandler(NewService(NewPostgres(db)))` on
`GET /api/v1/public/mock-exams`. Response: `{mocks: [{id,pathId,subjectId?,title,
questionCount,sectionCount,timeLimitSeconds}]}`. No attempts, question identities,
question/answer bodies or access grants are included.

The source MockExams page's `quizKind === 'mock'` maps to the existing canonical
`assessment_versions.assessment_kind='mock'`. Published/show-on-platform/approved
map to `assessments.is_published/is_visible/workflow_status='approved'` and the
canonical published version. Only platform ownership is included. Active path
ancestry, subject identity and level status are checked. No learning access,
publication, start, scoring or commerce policy is duplicated here.

Counts come from the published question references and sections. Time uses the
sum of section time limits, then version time limit, then the original 60-minute
default, expressed in seconds. Results retain source creation order without a
silent truncation. The frontend applies original path order and path-card summary.

Run isolated migrated PostgreSQL18 integration:

```sh
PUBLIC_MOCKS_TEST_DB=1 DATABASE_URL="$DATABASE_URL" go test ./internal/assessment/catalog -run TestPublicMockCatalogPostgresVisibilityAndPublishedSnapshot -count=1 -v
```

The fixture uses schema-local tables, excludes school/teacher/draft/hidden/normal
assessments and hidden ancestors, and checks a newer draft never replaces the
published summary. Local PostgreSQL is unavailable in the managed runtime; this
integration requires the real database CI gate.
