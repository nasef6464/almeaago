BEGIN;

ALTER TABLE assessment_sessions
  ADD COLUMN max_submissions integer
    CHECK (max_submissions IS NULL OR (max_submissions > 0 AND max_submissions <= 100000));

CREATE TABLE assessment_public_attempts (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  session_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  participant_key_hash bytea NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','submitted','expired')),
  start_key text NOT NULL UNIQUE CHECK (length(start_key) BETWEEN 8 AND 200),
  submission_key text UNIQUE CHECK (submission_key IS NULL OR length(submission_key) BETWEEN 8 AND 200),
  participant_name text NOT NULL DEFAULT '',
  school_name text NOT NULL DEFAULT '',
  classroom_name text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_id, assessment_id, assessment_version)
    REFERENCES assessment_sessions(id, assessment_id, assessment_version) ON DELETE RESTRICT,
  UNIQUE (id, assessment_id, assessment_version),
  UNIQUE (session_id, participant_key_hash, attempt_number),
  CONSTRAINT assessment_public_attempts_expiry_check CHECK (
    expires_at IS NULL OR expires_at > started_at
  ),
  CONSTRAINT assessment_public_attempts_submission_shape CHECK (
    (status='submitted' AND submitted_at IS NOT NULL AND submission_key IS NOT NULL)
    OR
    (status<>'submitted' AND submitted_at IS NULL)
  )
);

CREATE TABLE assessment_public_answers (
  public_attempt_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  question_id uuid NOT NULL,
  question_version integer NOT NULL CHECK (question_version > 0),
  selected_option_index integer CHECK (selected_option_index IS NULL OR selected_option_index >= 0),
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (public_attempt_id, question_id),
  FOREIGN KEY (public_attempt_id, assessment_id, assessment_version)
    REFERENCES assessment_public_attempts(id, assessment_id, assessment_version) ON DELETE RESTRICT,
  FOREIGN KEY (assessment_id, assessment_version, question_id, question_version)
    REFERENCES assessment_version_questions(assessment_id, assessment_version, question_id, question_version)
    ON DELETE RESTRICT,
  FOREIGN KEY (question_id, question_version, selected_option_index)
    REFERENCES question_options(question_id, version, option_index) ON DELETE RESTRICT
);

CREATE TABLE assessment_public_results (
  public_attempt_id uuid PRIMARY KEY,
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  score numeric(6,3) NOT NULL CHECK (score >= 0 AND score <= 100),
  total_questions integer NOT NULL CHECK (total_questions >= 0),
  correct_answers integer NOT NULL CHECK (correct_answers >= 0),
  wrong_answers integer NOT NULL CHECK (wrong_answers >= 0),
  unanswered integer NOT NULL CHECK (unanswered >= 0),
  passed boolean NOT NULL,
  time_spent_seconds integer NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  finalized_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (public_attempt_id, assessment_id, assessment_version)
    REFERENCES assessment_public_attempts(id, assessment_id, assessment_version) ON DELETE RESTRICT,
  CONSTRAINT assessment_public_results_count_shape CHECK (
    correct_answers + wrong_answers + unanswered = total_questions
  )
);

CREATE INDEX assessment_sessions_code_active_idx
  ON assessment_sessions(session_code, channel, status, opens_at, closes_at);

CREATE INDEX assessment_sessions_school_status_idx
  ON assessment_sessions(school_id, status, created_at DESC, id DESC)
  WHERE school_id IS NOT NULL;

CREATE INDEX assessment_public_attempts_participant_idx
  ON assessment_public_attempts(session_id, participant_key_hash, created_at DESC, id DESC);

CREATE INDEX assessment_public_attempts_recent_idx
  ON assessment_public_attempts(session_id, created_at DESC, id DESC);

COMMIT;
