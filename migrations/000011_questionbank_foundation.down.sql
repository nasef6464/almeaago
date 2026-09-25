BEGIN;

DROP INDEX IF EXISTS question_versions_media_idx;
DROP INDEX IF EXISTS question_versions_filter_idx;
DROP INDEX IF EXISTS questions_assigned_teacher_idx;
DROP INDEX IF EXISTS questions_owner_updated_idx;
DROP INDEX IF EXISTS questions_workflow_updated_idx;
DROP INDEX IF EXISTS questions_taxonomy_workflow_idx;

DROP TRIGGER IF EXISTS questions_question_code_immutable ON questions;
DROP FUNCTION IF EXISTS prevent_question_code_change();

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_current_version_fk;

ALTER TABLE question_options
  DROP CONSTRAINT IF EXISTS question_options_content_present,
  DROP CONSTRAINT IF EXISTS question_options_index_nonnegative;

ALTER TABLE question_versions
  DROP CONSTRAINT IF EXISTS question_versions_correct_option_nonnegative,
  DROP COLUMN IF EXISTS revision_note,
  DROP COLUMN IF EXISTS created_by;

ALTER TABLE questions
  DROP COLUMN IF EXISTS revenue_share_percentage,
  DROP COLUMN IF EXISTS reviewer_notes,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS assigned_teacher_id,
  DROP COLUMN IF EXISTS subject_id,
  DROP COLUMN IF EXISTS path_id;

COMMIT;
