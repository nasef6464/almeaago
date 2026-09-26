BEGIN;

DROP INDEX IF EXISTS review_answer_submissions_card_recent_idx;
DROP INDEX IF EXISTS review_answer_submissions_student_recent_idx;
DROP INDEX IF EXISTS mastery_evidence_review_submission_unique_idx;

ALTER TABLE mastery_evidence
  DROP CONSTRAINT IF EXISTS mastery_evidence_source_shape,
  DROP COLUMN IF EXISTS review_submission_id,
  ALTER COLUMN source_attempt_id SET NOT NULL,
  ALTER COLUMN assessment_id SET NOT NULL,
  ALTER COLUMN assessment_version SET NOT NULL;

DROP TABLE IF EXISTS review_answer_submissions;

COMMIT;
