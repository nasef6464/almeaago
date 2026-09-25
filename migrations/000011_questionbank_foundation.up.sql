BEGIN;

ALTER TABLE questions
  ADD COLUMN path_id uuid REFERENCES paths(id) ON DELETE RESTRICT,
  ADD COLUMN subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT,
  ADD COLUMN assigned_teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN reviewer_notes text NOT NULL DEFAULT '',
  ADD COLUMN revenue_share_percentage numeric(5,2)
    CHECK (revenue_share_percentage IS NULL OR (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100));

ALTER TABLE question_versions
  ADD COLUMN created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN revision_note text NOT NULL DEFAULT '',
  ADD CONSTRAINT question_versions_correct_option_nonnegative
    CHECK (correct_option_index IS NULL OR correct_option_index >= 0);

ALTER TABLE question_options
  ADD CONSTRAINT question_options_index_nonnegative CHECK (option_index >= 0),
  ADD CONSTRAINT question_options_content_present CHECK (option_text <> '' OR asset_id IS NOT NULL);

ALTER TABLE questions
  ADD CONSTRAINT questions_current_version_fk
  FOREIGN KEY (id, current_version)
  REFERENCES question_versions(question_id, version)
  DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION prevent_question_code_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.question_code IS DISTINCT FROM OLD.question_code THEN
    RAISE EXCEPTION 'question_code is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER questions_question_code_immutable
BEFORE UPDATE OF question_code ON questions
FOR EACH ROW
EXECUTE FUNCTION prevent_question_code_change();

CREATE INDEX questions_taxonomy_workflow_idx
  ON questions(path_id, subject_id, workflow_status, updated_at DESC, id DESC);

CREATE INDEX questions_workflow_updated_idx
  ON questions(workflow_status, updated_at DESC, id DESC);

CREATE INDEX questions_owner_updated_idx
  ON questions(owner_type, owner_id, updated_at DESC, id DESC);

CREATE INDEX questions_assigned_teacher_idx
  ON questions(assigned_teacher_id, workflow_status, updated_at DESC, id DESC)
  WHERE assigned_teacher_id IS NOT NULL;

CREATE INDEX question_versions_filter_idx
  ON question_versions(question_type, exam_type, source, source_year, difficulty, question_id, version);

CREATE INDEX question_versions_media_idx
  ON question_versions(image_asset_id)
  WHERE image_asset_id IS NOT NULL;

COMMIT;
