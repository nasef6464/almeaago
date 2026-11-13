BEGIN;

-- Existing assessment attempts retain their original version-based contract.
ALTER TABLE assessment_attempts
  ALTER COLUMN assessment_id DROP NOT NULL,
  ALTER COLUMN assessment_version DROP NOT NULL,
  ADD COLUMN attempt_kind text NOT NULL DEFAULT 'prepared' CHECK (attempt_kind IN ('prepared','self')),
  ADD CONSTRAINT assessment_attempt_kind_shape CHECK (
    (attempt_kind='prepared' AND assessment_id IS NOT NULL AND assessment_version IS NOT NULL)
    OR (attempt_kind='self' AND assessment_id IS NULL AND assessment_version IS NULL
        AND assignment_id IS NULL AND session_id IS NULL AND placement_id IS NULL)
  ),
  ADD CONSTRAINT assessment_attempt_id_kind_unique UNIQUE (id,attempt_kind),
  ADD CONSTRAINT assessment_attempt_owner_kind_unique UNIQUE (id,student_id,attempt_kind);

ALTER TABLE subjects ADD CONSTRAINT self_quiz_subject_path_unique UNIQUE (id,path_id);
ALTER TABLE skills ADD CONSTRAINT self_quiz_skill_subject_unique UNIQUE (id,subject_id);

CREATE TABLE self_quiz_settings (
  attempt_id uuid PRIMARY KEY,
  attempt_kind text NOT NULL DEFAULT 'self' CHECK (attempt_kind='self'),
  path_id uuid REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT,
  section_id uuid,
  difficulty text NOT NULL DEFAULT '' CHECK (difficulty IN ('','easy','medium','hard')),
  question_type text NOT NULL DEFAULT 'all' CHECK (question_type IN ('all','mcq','true_false')),
  evidence_type text NOT NULL CHECK (evidence_type IN ('assessment','remediation','recheck','mastery_review')),
  question_count integer NOT NULL CHECK (question_count BETWEEN 1 AND 60),
  time_limit_minutes integer NOT NULL CHECK (time_limit_minutes BETWEEN 5 AND 180),
  request_fingerprint text NOT NULL CHECK (btrim(request_fingerprint) <> ''),
  FOREIGN KEY (attempt_id,attempt_kind) REFERENCES assessment_attempts(id,attempt_kind) ON DELETE RESTRICT,
  FOREIGN KEY (subject_id,path_id) REFERENCES subjects(id,path_id) ON DELETE RESTRICT,
  UNIQUE (attempt_id,evidence_type)
);

CREATE TABLE self_quiz_target_skills (
  attempt_id uuid NOT NULL REFERENCES self_quiz_settings(attempt_id) ON DELETE RESTRICT,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  PRIMARY KEY (attempt_id,skill_id),
  UNIQUE (attempt_id,sort_order)
);

CREATE TABLE self_quiz_questions (
  attempt_id uuid NOT NULL,
  attempt_kind text NOT NULL DEFAULT 'self' CHECK (attempt_kind='self'),
  question_id uuid NOT NULL,
  question_version integer NOT NULL CHECK (question_version > 0),
  path_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  points numeric(10,3) NOT NULL DEFAULT 1 CHECK (points > 0),
  PRIMARY KEY (attempt_id,question_id),
  UNIQUE (attempt_id,question_id,question_version),
  UNIQUE (attempt_id,question_id,subject_id),
  UNIQUE (attempt_id,sort_order),
  FOREIGN KEY (attempt_id,attempt_kind) REFERENCES assessment_attempts(id,attempt_kind) ON DELETE RESTRICT,
  FOREIGN KEY (attempt_id) REFERENCES self_quiz_settings(attempt_id) ON DELETE RESTRICT,
  FOREIGN KEY (question_id,question_version) REFERENCES question_versions(question_id,version) ON DELETE RESTRICT,
  FOREIGN KEY (subject_id,path_id) REFERENCES subjects(id,path_id) ON DELETE RESTRICT
);

CREATE TABLE self_quiz_question_skills (
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  PRIMARY KEY (attempt_id,question_id,skill_id),
  FOREIGN KEY (attempt_id,question_id,subject_id) REFERENCES self_quiz_questions(attempt_id,question_id,subject_id) ON DELETE RESTRICT,
  FOREIGN KEY (skill_id,subject_id) REFERENCES skills(id,subject_id) ON DELETE RESTRICT
);

ALTER TABLE assessment_answers
  DROP CONSTRAINT assessment_answers_value_shape,
  ALTER COLUMN assessment_id DROP NOT NULL,
  ALTER COLUMN assessment_version DROP NOT NULL,
  ADD COLUMN self_attempt_id uuid,
  ADD CONSTRAINT assessment_answers_value_shape CHECK (
    (num_nonnulls(selected_option_index,text_answer)=1 OR (self_attempt_id IS NOT NULL AND num_nonnulls(selected_option_index,text_answer)=0))
    AND (text_answer IS NULL OR btrim(text_answer) <> '')
  ),
  ADD CONSTRAINT assessment_answer_source_shape CHECK (
    (assessment_id IS NOT NULL AND assessment_version IS NOT NULL AND self_attempt_id IS NULL)
    OR (assessment_id IS NULL AND assessment_version IS NULL AND self_attempt_id IS NOT NULL AND self_attempt_id=attempt_id)
  ),
  ADD CONSTRAINT assessment_answer_self_question_fk FOREIGN KEY (self_attempt_id,question_id,question_version)
    REFERENCES self_quiz_questions(attempt_id,question_id,question_version) ON DELETE RESTRICT;

ALTER TABLE assessment_results
  ALTER COLUMN assessment_id DROP NOT NULL,
  ALTER COLUMN assessment_version DROP NOT NULL,
  ADD COLUMN self_attempt_id uuid,
  ADD COLUMN self_attempt_kind text,
  ADD CONSTRAINT assessment_result_source_shape CHECK (
    (assessment_id IS NOT NULL AND assessment_version IS NOT NULL AND self_attempt_id IS NULL AND self_attempt_kind IS NULL)
    OR (assessment_id IS NULL AND assessment_version IS NULL AND self_attempt_id IS NOT NULL
        AND self_attempt_id=attempt_id AND self_attempt_kind IS NOT NULL AND self_attempt_kind='self')
  ),
  ADD CONSTRAINT assessment_result_self_owner_fk FOREIGN KEY (self_attempt_id,student_id,self_attempt_kind)
    REFERENCES assessment_attempts(id,student_id,attempt_kind) ON DELETE RESTRICT;

ALTER TABLE mastery_evidence
  DROP CONSTRAINT mastery_evidence_evidence_type_check,
  DROP CONSTRAINT mastery_evidence_source_shape,
  ADD COLUMN self_attempt_id uuid,
  ADD COLUMN self_attempt_kind text,
  ADD CONSTRAINT mastery_evidence_evidence_type_check CHECK (evidence_type IN ('assessment','practice','remediation','recheck','mastery_review','smart_classroom')),
  ADD CONSTRAINT mastery_evidence_source_shape CHECK (
    (self_attempt_id IS NOT NULL AND self_attempt_kind IS NOT NULL AND self_attempt_kind='self'
      AND source_attempt_id IS NOT NULL AND source_attempt_id=self_attempt_id AND assessment_id IS NULL AND assessment_version IS NULL
      AND review_submission_id IS NULL AND evidence_type IN ('assessment','remediation','recheck','mastery_review'))
    OR (self_attempt_id IS NULL AND self_attempt_kind IS NULL AND (
      (evidence_type='assessment' AND source_attempt_id IS NOT NULL AND assessment_id IS NOT NULL AND assessment_version IS NOT NULL AND review_submission_id IS NULL)
      OR (evidence_type IN ('remediation','mastery_review') AND source_attempt_id IS NULL AND assessment_id IS NULL AND assessment_version IS NULL AND review_submission_id IS NOT NULL)
      OR (evidence_type IN ('practice','smart_classroom') AND review_submission_id IS NULL AND
          ((source_attempt_id IS NULL AND assessment_id IS NULL AND assessment_version IS NULL)
           OR (source_attempt_id IS NOT NULL AND assessment_id IS NOT NULL AND assessment_version IS NOT NULL)))
    ))
  ),
  ADD CONSTRAINT mastery_evidence_self_owner_fk FOREIGN KEY (self_attempt_id,student_id,self_attempt_kind)
    REFERENCES assessment_attempts(id,student_id,attempt_kind) ON DELETE RESTRICT,
  ADD CONSTRAINT mastery_evidence_self_question_fk FOREIGN KEY (self_attempt_id,question_id,question_version)
    REFERENCES self_quiz_questions(attempt_id,question_id,question_version) ON DELETE RESTRICT,
  ADD CONSTRAINT mastery_evidence_self_type_fk FOREIGN KEY (self_attempt_id,evidence_type)
    REFERENCES self_quiz_settings(attempt_id,evidence_type) ON DELETE RESTRICT;

COMMIT;
