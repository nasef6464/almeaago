BEGIN;

CREATE TABLE review_answer_submissions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  review_card_id uuid NOT NULL REFERENCES review_cards(id) ON DELETE RESTRICT,
  question_id uuid NOT NULL,
  question_version integer NOT NULL CHECK (question_version > 0),
  selected_option_index integer NOT NULL CHECK (selected_option_index >= 0),
  is_correct boolean NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('remediation','mastery_review')),
  quality integer NOT NULL CHECK (quality >= 0 AND quality <= 5),
  submission_key text NOT NULL CHECK (length(btrim(submission_key)) BETWEEN 8 AND 160),
  review_type_after text NOT NULL CHECK (review_type_after IN ('error_recovery','mastery_review','saved_review')),
  next_review_at timestamptz NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (question_id, question_version)
    REFERENCES question_versions(question_id, version) ON DELETE RESTRICT,
  FOREIGN KEY (question_id, question_version, selected_option_index)
    REFERENCES question_options(question_id, version, option_index) ON DELETE RESTRICT,
  UNIQUE (student_id, submission_key)
);

ALTER TABLE mastery_evidence
  ALTER COLUMN source_attempt_id DROP NOT NULL,
  ALTER COLUMN assessment_id DROP NOT NULL,
  ALTER COLUMN assessment_version DROP NOT NULL,
  ADD COLUMN review_submission_id uuid REFERENCES review_answer_submissions(id) ON DELETE RESTRICT,
  ADD CONSTRAINT mastery_evidence_source_shape CHECK (
    (
      evidence_type='assessment'
      AND source_attempt_id IS NOT NULL
      AND assessment_id IS NOT NULL
      AND assessment_version IS NOT NULL
      AND review_submission_id IS NULL
    )
    OR
    (
      evidence_type IN ('remediation','mastery_review')
      AND source_attempt_id IS NULL
      AND assessment_id IS NULL
      AND assessment_version IS NULL
      AND review_submission_id IS NOT NULL
    )
    OR
    (
      evidence_type IN ('practice','smart_classroom')
      AND review_submission_id IS NULL
      AND (
        (source_attempt_id IS NULL AND assessment_id IS NULL AND assessment_version IS NULL)
        OR
        (source_attempt_id IS NOT NULL AND assessment_id IS NOT NULL AND assessment_version IS NOT NULL)
      )
    )
  );

CREATE UNIQUE INDEX mastery_evidence_review_submission_unique_idx
  ON mastery_evidence(review_submission_id, question_id)
  WHERE review_submission_id IS NOT NULL;

CREATE INDEX review_answer_submissions_student_recent_idx
  ON review_answer_submissions(student_id, submitted_at DESC, id DESC);

CREATE INDEX review_answer_submissions_card_recent_idx
  ON review_answer_submissions(review_card_id, submitted_at DESC, id DESC);

COMMIT;
