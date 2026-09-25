BEGIN;
CREATE OR REPLACE FUNCTION prevent_question_code_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.question_code IS DISTINCT FROM OLD.question_code THEN
    RAISE EXCEPTION 'question_code is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER questions_question_code_immutable
BEFORE UPDATE OF question_code ON questions
FOR EACH ROW EXECUTE FUNCTION prevent_question_code_change();

ALTER TABLE questions
  ADD CONSTRAINT questions_current_version_fk
  FOREIGN KEY (id, current_version)
  REFERENCES question_versions(question_id, version)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE question_options
  ADD CONSTRAINT question_options_index_nonnegative CHECK (option_index >= 0);

ALTER TABLE question_versions
  ADD CONSTRAINT question_versions_correct_option_nonnegative
    CHECK (correct_option_index IS NULL OR correct_option_index >= 0),
  ADD CONSTRAINT question_versions_source_year_sane
    CHECK (source_year IS NULL OR source_year BETWEEN 1900 AND 2200);

CREATE INDEX questions_workflow_updated_idx
  ON questions(workflow_status, updated_at DESC, id);
CREATE INDEX questions_owner_workflow_updated_idx
  ON questions(owner_type, owner_id, workflow_status, updated_at DESC, id)
  WHERE owner_id IS NOT NULL;
CREATE INDEX question_versions_filter_idx
  ON question_versions(question_type, difficulty, exam_type, source, source_year, question_id, version DESC);
CREATE INDEX question_skill_links_question_relation_idx
  ON question_skill_links(question_id, relation_type, skill_id);
COMMIT;
