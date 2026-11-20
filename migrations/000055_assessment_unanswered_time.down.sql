BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM assessment_answers WHERE self_attempt_id IS NULL AND selected_option_index IS NULL AND text_answer IS NULL) THEN
    RAISE EXCEPTION 'Cannot downgrade while unanswered prepared-attempt time records exist';
  END IF;
END $$;
ALTER TABLE assessment_answers
  DROP CONSTRAINT assessment_answers_value_shape,
  ADD CONSTRAINT assessment_answers_value_shape CHECK (
    (num_nonnulls(selected_option_index,text_answer)=1 OR (self_attempt_id IS NOT NULL AND num_nonnulls(selected_option_index,text_answer)=0))
    AND (text_answer IS NULL OR btrim(text_answer) <> '')
  );
COMMIT;
