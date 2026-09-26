BEGIN;

DROP TABLE IF EXISTS assessment_public_results;
DROP TABLE IF EXISTS assessment_public_answers;
DROP TABLE IF EXISTS assessment_public_attempts;

DROP INDEX IF EXISTS assessment_sessions_school_status_idx;
DROP INDEX IF EXISTS assessment_sessions_code_active_idx;

ALTER TABLE assessment_sessions
  DROP COLUMN IF EXISTS max_submissions;

COMMIT;
