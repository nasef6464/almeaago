BEGIN;
ALTER TABLE assessment_answers
  DROP CONSTRAINT assessment_answers_value_shape,
  ADD CONSTRAINT assessment_answers_value_shape CHECK (
    num_nonnulls(selected_option_index,text_answer) <= 1
    AND (text_answer IS NULL OR btrim(text_answer) <> '')
  );
COMMIT;
