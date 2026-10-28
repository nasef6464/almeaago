# SCHOOL-005C2 — School Assessment Learner Results Parity

## Intent

Finish the next verifiable slice of the ALMEAA Node school-assessment workflow in Go/PostgreSQL without redesigning the existing RTL screen. After a director creates a school or class assessment, authorized staff can distinguish students who submitted, missed, or require support, find a student, and inspect persisted outcome evidence. The original `schoolAssessmentLearners.ts` and `SchoolAssessmentLearnersPanel.tsx` are the behavior baseline.

## Scope and non-goals

- Endpoint: `GET /api/school-access/director/schools/{schoolId}/academic/assessments/{assessmentId}/learners` with `status=all|completed|not_completed|needs_support`, `search`, `page`, `limit`; default page 1, limit 12, upper bounds 100000/100, search length 120.
- Endpoint: `GET /api/school-access/director/schools/{schoolId}/academic/assessments/{assessmentId}/results/{attemptId}` for a selected student's *submitted, school-assigned* result and persisted skill/section evidence. No answer keys or unverified question review.
- Both require *both* `SCHOOL_REPORTS_DETAILED_VIEW` and `SCHOOL_INTELLIGENCE`, and the active `SCHOOL_ASSESSMENTS` contract. Aggregate-only permissions cannot unlock learners.
- Re-check actor membership and permissions and both active contracts within the PostgreSQL read, independent of the application check. Limit all evidence to active targeted learners at the indicated school; never count a practice attempt, another school's assignment, or an inactive learner.
- The latest submitted school-assigned result per student wins; latest `passed=false` means `needs_support` regardless of numerical score. Display one learner once, sort by name and ID, count filtered rows before pagination, provide retries and stale-request cancellation.
- Do not alter scoring, historical results, production data, permissions defaults or the Node source. Do not fabricate started metrics, subject results or question-level answer reviews where no saved evidence exists.
- Future distinct batches: 005C3 assessment manage actions (edit/clone/reopen/reminders); 005C4 evidence-backed subject/question analysis; 005D visual parity; 005E central-exam advanced features.

## Central-exam reference and architectural choice

Classera's official Central Exam case study describes distributing one standardized assessment to designated classes and measuring standards mastery; its manuals describe shared school question banks and grade/subject/date report filters with export. ALMEAA already has a school-owned definition, approved bank picker, assignment audience and school report. Preserve the legacy ALMEAA presentation and extend this modular monolith one bounded evidence-backed slice at a time. Do not add a Classera-like multi-school exam-supervisor actor or cross-school question sharing without a separate role/authorization design. References:

- https://classera.com/en/company/case_study_details/sssfs/
- https://manual.classera.com/docs/questions-banks/
- https://manualbsera.classera.com/ar/docs/central-exams-comprehensive-report/

## Approach choice

1. **Recommended:** keep the current Go assessment schema, add two strongly scoped read endpoints and a lazily loaded roster/details tab; no schema migration, no new data authority. Fits the merged 005C1 report and the legacy Node screen.
2. Move to a universal analytics engine now: more flexible, but risks exposing old evidence across scopes and delays a functioning school workflow.
3. Clone Classera's full central-exams suite first: not the requested exact ALMEAA copy and needs decisions about cross-school control and licensing.

Owner explicitly delegated technical choices and asked to proceed without further confirmation; use approach 1. Existing UI stays the design authority, tested at mobile 390 and desktop 1440 widths.

## Evidence and acceptance

- Postgres integration with real migrations: targeted audience classes/whole school, missing results, newer school result, unrelated school/practice result, disabled learner, revoked detailed permission/module; latest submitted only.
- App + transport tests: invalid query, actor/context denied, no-store, summary-only actor unable to see names/results.
- Playwright: Arabic tabs, filter/search/paging and detail display, unauthorized tab hidden, school switch clears previously selected learner, 390/1440 no page overflow.
- Exact HEAD GitHub Backend/Database/Frontend/E2E gates required before merging; a passing isolated CI is not a production cutover claim.
