# School assessment builder settings parity — implementation plan

Source of truth: `almeaacodax/dashboards/admin/QuizBuilder.tsx` settings panel, plus PostgreSQL `migrations/000020_assessment_foundation.up.sql`. Preserve current old school creator and its API defaults for callers omitting settings. Add explicit opt-in settings object for school exams.

1. RED service validation tests: values for duration, success score, attempts, option layout, and toggles; reject invalid values and non-school director. GREEN by typed settings domain + input validation.
2. RED fingerprint test: changed settings conflict with same idempotency key. GREEN JSON fingerprint that omits settings entirely when absent (preserve old fingerprints), and write provided settings into existing `assessment_versions` columns inside same transaction. Real DB test asserts settings actually persisted.
3. RED Playwright: school director chooses different settings for central exam and submits; verify settings payload, mobile and desktop width. GREEN add compact Arabic accessible fieldset without rearranging the existing builder.
4. Run Go/TypeScript/Playwright; draft PR; await four CI workflows including real PostgreSQL; merge only when green. Document exact remaining gaps (scheduling, edits, dashboards).
