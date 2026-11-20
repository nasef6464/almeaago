BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM assessment_attempts WHERE attempt_kind='self') THEN
    RAISE EXCEPTION 'Cannot remove self-quiz schema while self attempts exist';
  END IF;
END $$;

ALTER TABLE mastery_evidence
  DROP CONSTRAINT mastery_evidence_self_type_fk,
  DROP CONSTRAINT mastery_evidence_self_question_fk,
  DROP CONSTRAINT mastery_evidence_self_owner_fk,
  DROP CONSTRAINT mastery_evidence_source_shape,
  DROP CONSTRAINT mastery_evidence_evidence_type_check,
  DROP COLUMN self_attempt_id,
  DROP COLUMN self_attempt_kind,
  ADD CONSTRAINT mastery_evidence_evidence_type_check CHECK (evidence_type IN ('assessment','practice','remediation','mastery_review','smart_classroom')),
  ADD CONSTRAINT mastery_evidence_source_shape CHECK (
    (evidence_type='assessment' AND source_attempt_id IS NOT NULL AND assessment_id IS NOT NULL AND assessment_version IS NOT NULL AND review_submission_id IS NULL)
    OR (evidence_type IN ('remediation','mastery_review') AND source_attempt_id IS NULL AND assessment_id IS NULL AND assessment_version IS NULL AND review_submission_id IS NOT NULL)
    OR (evidence_type IN ('practice','smart_classroom') AND review_submission_id IS NULL AND
        ((source_attempt_id IS NULL AND assessment_id IS NULL AND assessment_version IS NULL)
         OR (source_attempt_id IS NOT NULL AND assessment_id IS NOT NULL AND assessment_version IS NOT NULL)))
  );

ALTER TABLE assessment_results
  DROP CONSTRAINT assessment_result_self_owner_fk,
  DROP CONSTRAINT assessment_result_source_shape,
  DROP COLUMN self_attempt_id,
  DROP COLUMN self_attempt_kind,
  ALTER COLUMN assessment_id SET NOT NULL,
  ALTER COLUMN assessment_version SET NOT NULL;

ALTER TABLE assessment_answers
  DROP CONSTRAINT assessment_answers_value_shape,
  DROP CONSTRAINT assessment_answer_self_question_fk,
  DROP CONSTRAINT assessment_answer_source_shape,
  DROP COLUMN self_attempt_id,
  ALTER COLUMN assessment_id SET NOT NULL,
  ALTER COLUMN assessment_version SET NOT NULL,
  ADD CONSTRAINT assessment_answers_value_shape CHECK (num_nonnulls(selected_option_index,text_answer)=1 AND (text_answer IS NULL OR btrim(text_answer) <> ''));

DROP TABLE self_quiz_question_skills;
DROP TABLE self_quiz_questions;
DROP TABLE self_quiz_target_skills;
DROP TABLE self_quiz_settings;
ALTER TABLE skills DROP CONSTRAINT self_quiz_skill_subject_unique;
ALTER TABLE subjects DROP CONSTRAINT self_quiz_subject_path_unique;

ALTER TABLE assessment_attempts
  DROP CONSTRAINT assessment_attempt_owner_kind_unique,
  DROP CONSTRAINT assessment_attempt_id_kind_unique,
  DROP CONSTRAINT assessment_attempt_kind_shape,
  DROP COLUMN attempt_kind,
  ALTER COLUMN assessment_id SET NOT NULL,
  ALTER COLUMN assessment_version SET NOT NULL;

COMMIT;
