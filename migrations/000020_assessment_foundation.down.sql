BEGIN;

DROP TABLE IF EXISTS assessment_result_skill_summaries;
DROP TABLE IF EXISTS assessment_result_sections;
DROP TABLE IF EXISTS assessment_results;
DROP TABLE IF EXISTS assessment_answers;
DROP TABLE IF EXISTS assessment_attempts;
DROP TABLE IF EXISTS assessment_sessions;
DROP TABLE IF EXISTS assessment_assignment_classes;
DROP TABLE IF EXISTS assessment_assignment_users;
DROP TABLE IF EXISTS assessment_assignments;
DROP TABLE IF EXISTS assessment_learning_placements;
DROP TABLE IF EXISTS assessment_version_questions;
DROP TABLE IF EXISTS assessment_sections;

ALTER TABLE IF EXISTS assessments
  DROP CONSTRAINT IF EXISTS assessments_published_version_fk,
  DROP CONSTRAINT IF EXISTS assessments_current_version_fk;

DROP TRIGGER IF EXISTS assessments_code_immutable ON assessments;
DROP FUNCTION IF EXISTS prevent_assessment_code_change();

DROP TABLE IF EXISTS assessment_versions;
DROP TABLE IF EXISTS assessments;

COMMIT;
