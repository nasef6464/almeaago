BEGIN;

CREATE TABLE mastery_evidence (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  evidence_type text NOT NULL CHECK (evidence_type IN ('assessment','practice','remediation','mastery_review','smart_classroom')),
  source_attempt_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  question_id uuid NOT NULL,
  question_version integer NOT NULL CHECK (question_version > 0),
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  answered boolean NOT NULL,
  is_correct boolean NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (source_attempt_id, assessment_id, assessment_version)
    REFERENCES assessment_attempts(id, assessment_id, assessment_version) ON DELETE RESTRICT,
  FOREIGN KEY (question_id, question_version)
    REFERENCES question_versions(question_id, version) ON DELETE RESTRICT,
  UNIQUE (evidence_type, source_attempt_id, question_id)
);

CREATE TABLE mastery_evidence_skills (
  evidence_id uuid NOT NULL REFERENCES mastery_evidence(id) ON DELETE RESTRICT,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evidence_id, skill_id)
);

CREATE TABLE skill_progress (
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  mastery numeric(6,3) NOT NULL DEFAULT 0 CHECK (mastery >= 0 AND mastery <= 100),
  status text NOT NULL DEFAULT 'weak' CHECK (status IN ('weak','average','good','mastered')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  evidence_count integer NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  last_attempt_id uuid REFERENCES assessment_attempts(id) ON DELETE RESTRICT,
  last_evidence_at timestamptz,
  recommended_action text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, path_id, subject_id, skill_id)
);

CREATE TABLE review_cards (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  question_version integer NOT NULL CHECK (question_version > 0),
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  primary_skill_id uuid REFERENCES skills(id) ON DELETE RESTRICT,
  review_type text NOT NULL DEFAULT 'error_recovery'
    CHECK (review_type IN ('error_recovery','mastery_review','saved_review')),
  saved_for_review boolean NOT NULL DEFAULT false,
  saved_at timestamptz,
  has_mistake boolean NOT NULL DEFAULT false,
  ease_factor numeric(5,3) NOT NULL DEFAULT 2.5 CHECK (ease_factor >= 1.3),
  interval_days integer NOT NULL DEFAULT 1 CHECK (interval_days >= 0),
  repetitions integer NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  next_review_at timestamptz NOT NULL DEFAULT now(),
  last_quality integer NOT NULL DEFAULT 0 CHECK (last_quality >= 0 AND last_quality <= 5),
  last_evidence_id uuid REFERENCES mastery_evidence(id) ON DELETE RESTRICT,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (question_id, question_version)
    REFERENCES question_versions(question_id, version) ON DELETE RESTRICT,
  UNIQUE (student_id, question_id),
  CONSTRAINT review_cards_saved_shape CHECK (saved_for_review OR saved_at IS NULL)
);

CREATE TABLE review_card_skills (
  review_card_id uuid NOT NULL REFERENCES review_cards(id) ON DELETE RESTRICT,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_card_id, skill_id)
);

CREATE INDEX mastery_evidence_student_recent_idx
  ON mastery_evidence(student_id, occurred_at DESC, id DESC);
CREATE INDEX mastery_evidence_attempt_idx
  ON mastery_evidence(source_attempt_id, question_id);
CREATE INDEX mastery_evidence_skills_skill_idx
  ON mastery_evidence_skills(skill_id, evidence_id);
CREATE INDEX skill_progress_student_mastery_idx
  ON skill_progress(student_id, path_id, subject_id, mastery, last_evidence_at DESC, skill_id);
CREATE INDEX review_cards_student_due_idx
  ON review_cards(student_id, path_id, subject_id, next_review_at, id);
CREATE INDEX review_cards_student_saved_idx
  ON review_cards(student_id, path_id, subject_id, updated_at DESC, id DESC)
  WHERE saved_for_review=true;
CREATE INDEX review_cards_student_mistake_idx
  ON review_cards(student_id, path_id, subject_id, updated_at DESC, id DESC)
  WHERE has_mistake=true OR review_type='error_recovery';
CREATE INDEX review_card_skills_skill_idx
  ON review_card_skills(skill_id, review_card_id);

COMMIT;
