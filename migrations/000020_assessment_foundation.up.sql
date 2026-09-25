BEGIN;

CREATE TABLE assessments (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  assessment_code text NOT NULL UNIQUE CHECK (btrim(assessment_code) <> ''),
  owner_type text NOT NULL DEFAULT 'platform'
    CHECK (owner_type IN ('platform','teacher','school')),
  owner_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  owner_school_id uuid REFERENCES schools(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  workflow_status text NOT NULL DEFAULT 'draft'
    CHECK (workflow_status IN ('draft','pending_review','approved','rejected','archived')),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  reviewer_notes text NOT NULL DEFAULT '',
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  published_version integer CHECK (published_version IS NULL OR published_version > 0),
  is_published boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessments_owner_shape CHECK (
    (owner_type='platform' AND owner_user_id IS NULL AND owner_school_id IS NULL)
    OR (owner_type='teacher' AND owner_user_id IS NOT NULL AND owner_school_id IS NULL)
    OR (owner_type='school' AND owner_user_id IS NULL AND owner_school_id IS NOT NULL)
  ),
  CONSTRAINT assessments_publication_shape CHECK (
    NOT is_published
    OR (workflow_status='approved' AND published_version IS NOT NULL)
  ),
  CONSTRAINT assessments_published_version_not_future CHECK (
    published_version IS NULL OR published_version <= current_version
  )
);

CREATE TABLE assessment_versions (
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL DEFAULT '',
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT,
  assessment_kind text NOT NULL
    CHECK (assessment_kind IN ('normal','mock')),
  normal_mode text
    CHECK (normal_mode IS NULL OR normal_mode IN ('practice','exam')),
  version_status text NOT NULL DEFAULT 'draft'
    CHECK (version_status IN ('draft','published','superseded')),
  show_explanations boolean NOT NULL DEFAULT true,
  show_answers boolean NOT NULL DEFAULT true,
  show_results_report boolean NOT NULL DEFAULT true,
  return_to_source_on_finish boolean NOT NULL DEFAULT false,
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0 AND max_attempts <= 100),
  passing_score numeric(5,2) NOT NULL DEFAULT 60
    CHECK (passing_score >= 0 AND passing_score <= 100),
  time_limit_seconds integer
    CHECK (time_limit_seconds IS NULL OR time_limit_seconds > 0),
  randomize_questions boolean NOT NULL DEFAULT true,
  randomize_options boolean NOT NULL DEFAULT false,
  show_progress_bar boolean NOT NULL DEFAULT true,
  require_answer_before_next boolean NOT NULL DEFAULT false,
  allow_question_review boolean NOT NULL DEFAULT true,
  option_layout text NOT NULL DEFAULT 'auto'
    CHECK (option_layout IN ('auto','horizontal','two_columns')),
  mock_category text
    CHECK (mock_category IS NULL OR mock_category IN ('qudrat','tahsili','specialized')),
  mock_target_score numeric(5,2)
    CHECK (mock_target_score IS NULL OR (mock_target_score >= 0 AND mock_target_score <= 100)),
  mock_strict_section_lock boolean,
  mock_presentation_mode text
    CHECK (mock_presentation_mode IS NULL OR mock_presentation_mode IN ('qiyas_strict','flexible')),
  presentation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  revision_note text NOT NULL DEFAULT '',
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_id, version),
  CONSTRAINT assessment_versions_kind_shape CHECK (
    (assessment_kind='normal'
      AND normal_mode IN ('practice','exam')
      AND mock_category IS NULL
      AND mock_target_score IS NULL
      AND mock_strict_section_lock IS NULL
      AND mock_presentation_mode IS NULL)
    OR
    (assessment_kind='mock'
      AND normal_mode IS NULL
      AND mock_category IS NOT NULL
      AND mock_target_score IS NOT NULL
      AND mock_strict_section_lock IS NOT NULL
      AND mock_presentation_mode IS NOT NULL)
  ),
  CONSTRAINT assessment_versions_publication_shape CHECK (
    (version_status='draft' AND published_at IS NULL AND published_by IS NULL)
    OR
    (version_status IN ('published','superseded') AND published_at IS NOT NULL)
  )
);

ALTER TABLE assessments
  ADD CONSTRAINT assessments_current_version_fk
    FOREIGN KEY (id, current_version)
    REFERENCES assessment_versions(assessment_id, version)
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT assessments_published_version_fk
    FOREIGN KEY (id, published_version)
    REFERENCES assessment_versions(assessment_id, version)
    DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION prevent_assessment_code_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.assessment_code IS DISTINCT FROM OLD.assessment_code THEN
    RAISE EXCEPTION 'assessment_code is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assessments_code_immutable
BEFORE UPDATE OF assessment_code ON assessments
FOR EACH ROW
EXECUTE FUNCTION prevent_assessment_code_change();

CREATE TABLE assessment_sections (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  title text NOT NULL CHECK (btrim(title) <> ''),
  subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  time_limit_seconds integer
    CHECK (time_limit_seconds IS NULL OR time_limit_seconds > 0),
  domain text NOT NULL DEFAULT 'general' CHECK (btrim(domain) <> ''),
  strict_lock boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, assessment_version)
    REFERENCES assessment_versions(assessment_id, version) ON DELETE RESTRICT,
  UNIQUE (id, assessment_id, assessment_version)
);

CREATE TABLE assessment_version_questions (
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  question_id uuid NOT NULL,
  question_version integer NOT NULL CHECK (question_version > 0),
  section_id uuid,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  points numeric(8,2) NOT NULL DEFAULT 1 CHECK (points > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_id, assessment_version, question_id),
  FOREIGN KEY (assessment_id, assessment_version)
    REFERENCES assessment_versions(assessment_id, version) ON DELETE RESTRICT,
  FOREIGN KEY (question_id, question_version)
    REFERENCES question_versions(question_id, version) ON DELETE RESTRICT,
  FOREIGN KEY (section_id, assessment_id, assessment_version)
    REFERENCES assessment_sections(id, assessment_id, assessment_version) ON DELETE RESTRICT,
  UNIQUE (assessment_id, assessment_version, question_id, question_version)
);

CREATE TABLE assessment_learning_placements (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  slot text NOT NULL CHECK (slot IN ('training','tests','foundation','course')),
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT,
  course_id uuid REFERENCES courses(id) ON DELETE RESTRICT,
  lesson_id uuid REFERENCES lessons(id) ON DELETE RESTRICT,
  topic_id uuid REFERENCES foundation_topics(id) ON DELETE RESTRICT,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, assessment_version)
    REFERENCES assessment_versions(assessment_id, version) ON DELETE RESTRICT,
  UNIQUE (id, assessment_id, assessment_version),
  CONSTRAINT assessment_learning_placements_shape CHECK (
    (slot IN ('training','tests') AND course_id IS NULL AND lesson_id IS NULL AND topic_id IS NULL)
    OR
    (slot='foundation' AND topic_id IS NOT NULL AND course_id IS NULL AND lesson_id IS NULL)
    OR
    (slot='course' AND course_id IS NOT NULL AND topic_id IS NULL)
  )
);

CREATE UNIQUE INDEX assessment_learning_placements_identity_idx
  ON assessment_learning_placements(
    assessment_id,
    assessment_version,
    slot,
    path_id,
    COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(course_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(lesson_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(topic_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE TABLE assessment_assignments (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  school_id uuid REFERENCES schools(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','closed','cancelled')),
  opens_at timestamptz,
  closes_at timestamptz,
  max_attempts_override integer
    CHECK (max_attempts_override IS NULL OR (max_attempts_override > 0 AND max_attempts_override <= 100)),
  supervisor_message text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, assessment_version)
    REFERENCES assessment_versions(assessment_id, version) ON DELETE RESTRICT,
  UNIQUE (id, assessment_id, assessment_version),
  CONSTRAINT assessment_assignments_window_check CHECK (
    opens_at IS NULL OR closes_at IS NULL OR closes_at > opens_at
  )
);

CREATE TABLE assessment_assignment_users (
  assignment_id uuid NOT NULL REFERENCES assessment_assignments(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, user_id)
);

CREATE TABLE assessment_assignment_classes (
  assignment_id uuid NOT NULL REFERENCES assessment_assignments(id) ON DELETE RESTRICT,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, class_id)
);

CREATE TABLE assessment_sessions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  channel text NOT NULL CHECK (channel IN ('public','barcode','live')),
  session_code text NOT NULL UNIQUE CHECK (btrim(session_code) <> ''),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','active','closed','cancelled')),
  school_id uuid REFERENCES schools(id) ON DELETE RESTRICT,
  class_id uuid REFERENCES classes(id) ON DELETE RESTRICT,
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, assessment_version)
    REFERENCES assessment_versions(assessment_id, version) ON DELETE RESTRICT,
  UNIQUE (id, assessment_id, assessment_version),
  CONSTRAINT assessment_sessions_window_check CHECK (
    opens_at IS NULL OR closes_at IS NULL OR closes_at > opens_at
  )
);

CREATE TABLE assessment_attempts (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assignment_id uuid,
  session_id uuid,
  placement_id uuid,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','submitted','expired','abandoned')),
  start_key text UNIQUE,
  submission_key text UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  source_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  section_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, assessment_version)
    REFERENCES assessment_versions(assessment_id, version) ON DELETE RESTRICT,
  FOREIGN KEY (assignment_id, assessment_id, assessment_version)
    REFERENCES assessment_assignments(id, assessment_id, assessment_version) ON DELETE RESTRICT,
  FOREIGN KEY (session_id, assessment_id, assessment_version)
    REFERENCES assessment_sessions(id, assessment_id, assessment_version) ON DELETE RESTRICT,
  FOREIGN KEY (placement_id, assessment_id, assessment_version)
    REFERENCES assessment_learning_placements(id, assessment_id, assessment_version) ON DELETE RESTRICT,
  UNIQUE (id, assessment_id, assessment_version),
  CONSTRAINT assessment_attempts_context_shape CHECK (
    num_nonnulls(assignment_id, session_id, placement_id) <= 1
  ),
  CONSTRAINT assessment_attempts_expiry_check CHECK (
    expires_at IS NULL OR expires_at > started_at
  ),
  CONSTRAINT assessment_attempts_submission_shape CHECK (
    (status='submitted' AND submitted_at IS NOT NULL)
    OR
    (status<>'submitted' AND submitted_at IS NULL)
  )
);

CREATE UNIQUE INDEX assessment_attempts_self_number_unique
  ON assessment_attempts(assessment_id, assessment_version, student_id, attempt_number)
  WHERE assignment_id IS NULL AND session_id IS NULL AND placement_id IS NULL;

CREATE UNIQUE INDEX assessment_attempts_assignment_number_unique
  ON assessment_attempts(assignment_id, student_id, attempt_number)
  WHERE assignment_id IS NOT NULL;

CREATE UNIQUE INDEX assessment_attempts_session_number_unique
  ON assessment_attempts(session_id, student_id, attempt_number)
  WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX assessment_attempts_placement_number_unique
  ON assessment_attempts(placement_id, student_id, attempt_number)
  WHERE placement_id IS NOT NULL;

CREATE TABLE assessment_answers (
  attempt_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  question_id uuid NOT NULL,
  question_version integer NOT NULL CHECK (question_version > 0),
  selected_option_index integer CHECK (selected_option_index IS NULL OR selected_option_index >= 0),
  text_answer text,
  first_answered_at timestamptz NOT NULL DEFAULT now(),
  last_saved_at timestamptz NOT NULL DEFAULT now(),
  time_spent_seconds integer NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  marked_for_review boolean NOT NULL DEFAULT false,
  is_correct boolean,
  scored_at timestamptz,
  PRIMARY KEY (attempt_id, question_id),
  FOREIGN KEY (attempt_id, assessment_id, assessment_version)
    REFERENCES assessment_attempts(id, assessment_id, assessment_version) ON DELETE RESTRICT,
  FOREIGN KEY (assessment_id, assessment_version, question_id, question_version)
    REFERENCES assessment_version_questions(assessment_id, assessment_version, question_id, question_version)
    ON DELETE RESTRICT,
  FOREIGN KEY (question_id, question_version, selected_option_index)
    REFERENCES question_options(question_id, version, option_index) ON DELETE RESTRICT,
  CONSTRAINT assessment_answers_value_shape CHECK (
    num_nonnulls(selected_option_index, text_answer) = 1
    AND (text_answer IS NULL OR btrim(text_answer) <> '')
  ),
  CONSTRAINT assessment_answers_time_shape CHECK (
    last_saved_at >= first_answered_at
  ),
  CONSTRAINT assessment_answers_score_shape CHECK (
    (is_correct IS NULL AND scored_at IS NULL)
    OR
    (is_correct IS NOT NULL AND scored_at IS NOT NULL)
  )
);

CREATE TABLE assessment_results (
  attempt_id uuid PRIMARY KEY,
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  score numeric(6,3) NOT NULL CHECK (score >= 0 AND score <= 100),
  total_questions integer NOT NULL CHECK (total_questions >= 0),
  correct_answers integer NOT NULL CHECK (correct_answers >= 0),
  wrong_answers integer NOT NULL CHECK (wrong_answers >= 0),
  unanswered integer NOT NULL CHECK (unanswered >= 0),
  passed boolean NOT NULL,
  time_spent_seconds integer NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  finalized_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (attempt_id, assessment_id, assessment_version)
    REFERENCES assessment_attempts(id, assessment_id, assessment_version) ON DELETE RESTRICT,
  UNIQUE (attempt_id, assessment_id, assessment_version),
  CONSTRAINT assessment_results_count_shape CHECK (
    correct_answers + wrong_answers + unanswered = total_questions
  )
);

CREATE TABLE assessment_result_sections (
  attempt_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  section_id uuid NOT NULL,
  score numeric(6,3) NOT NULL CHECK (score >= 0 AND score <= 100),
  total_questions integer NOT NULL CHECK (total_questions >= 0),
  correct_answers integer NOT NULL CHECK (correct_answers >= 0),
  wrong_answers integer NOT NULL CHECK (wrong_answers >= 0),
  unanswered integer NOT NULL CHECK (unanswered >= 0),
  time_spent_seconds integer NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  PRIMARY KEY (attempt_id, section_id),
  FOREIGN KEY (attempt_id, assessment_id, assessment_version)
    REFERENCES assessment_results(attempt_id, assessment_id, assessment_version) ON DELETE RESTRICT,
  FOREIGN KEY (section_id, assessment_id, assessment_version)
    REFERENCES assessment_sections(id, assessment_id, assessment_version) ON DELETE RESTRICT,
  CONSTRAINT assessment_result_sections_count_shape CHECK (
    correct_answers + wrong_answers + unanswered = total_questions
  )
);

CREATE TABLE assessment_result_skill_summaries (
  attempt_id uuid NOT NULL REFERENCES assessment_results(attempt_id) ON DELETE RESTRICT,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  score numeric(6,3) NOT NULL CHECK (score >= 0 AND score <= 100),
  total_questions integer NOT NULL CHECK (total_questions >= 0),
  correct_answers integer NOT NULL CHECK (correct_answers >= 0),
  wrong_answers integer NOT NULL CHECK (wrong_answers >= 0),
  unanswered integer NOT NULL CHECK (unanswered >= 0),
  PRIMARY KEY (attempt_id, skill_id),
  CONSTRAINT assessment_result_skill_count_shape CHECK (
    correct_answers + wrong_answers + unanswered = total_questions
  )
);

CREATE INDEX assessments_workflow_updated_idx
  ON assessments(workflow_status, updated_at DESC, id DESC);

CREATE INDEX assessments_owner_user_updated_idx
  ON assessments(owner_user_id, workflow_status, updated_at DESC, id DESC)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX assessments_owner_school_updated_idx
  ON assessments(owner_school_id, workflow_status, updated_at DESC, id DESC)
  WHERE owner_school_id IS NOT NULL;

CREATE INDEX assessments_assigned_teacher_updated_idx
  ON assessments(assigned_teacher_id, workflow_status, updated_at DESC, id DESC)
  WHERE assigned_teacher_id IS NOT NULL;

CREATE INDEX assessment_versions_taxonomy_idx
  ON assessment_versions(path_id, subject_id, assessment_kind, normal_mode, assessment_id, version DESC);

CREATE INDEX assessment_sections_order_idx
  ON assessment_sections(assessment_id, assessment_version, sort_order, id);

CREATE INDEX assessment_version_questions_order_idx
  ON assessment_version_questions(assessment_id, assessment_version, section_id, sort_order, question_id);

CREATE INDEX assessment_version_questions_question_idx
  ON assessment_version_questions(question_id, question_version, assessment_id, assessment_version);

CREATE INDEX assessment_learning_placements_scope_idx
  ON assessment_learning_placements(path_id, subject_id, slot, is_visible, sort_order, id);

CREATE INDEX assessment_assignments_version_status_idx
  ON assessment_assignments(assessment_id, assessment_version, status, created_at DESC, id DESC);

CREATE INDEX assessment_assignments_school_status_idx
  ON assessment_assignments(school_id, status, created_at DESC, id DESC)
  WHERE school_id IS NOT NULL;

CREATE INDEX assessment_assignment_users_user_idx
  ON assessment_assignment_users(user_id, assignment_id);

CREATE INDEX assessment_assignment_classes_class_idx
  ON assessment_assignment_classes(class_id, assignment_id);

CREATE INDEX assessment_sessions_version_status_idx
  ON assessment_sessions(assessment_id, assessment_version, status, created_at DESC, id DESC);

CREATE INDEX assessment_attempts_student_recent_idx
  ON assessment_attempts(student_id, created_at DESC, id DESC);

CREATE INDEX assessment_attempts_assessment_status_recent_idx
  ON assessment_attempts(assessment_id, status, created_at DESC, id DESC);

CREATE INDEX assessment_attempts_student_active_idx
  ON assessment_attempts(student_id, updated_at DESC, id DESC)
  WHERE status='in_progress';

CREATE INDEX assessment_answers_attempt_saved_idx
  ON assessment_answers(attempt_id, last_saved_at DESC, question_id);

CREATE INDEX assessment_results_student_recent_idx
  ON assessment_results(student_id, finalized_at DESC, attempt_id);

CREATE INDEX assessment_results_assessment_recent_idx
  ON assessment_results(assessment_id, finalized_at DESC, attempt_id);

CREATE INDEX assessment_result_skill_summaries_skill_idx
  ON assessment_result_skill_summaries(skill_id, attempt_id);

COMMIT;
