BEGIN;

CREATE TABLE school_contracts (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  school_id uuid NOT NULL UNIQUE REFERENCES schools(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','expired')),
  valid_from timestamptz,
  valid_until timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE INDEX school_contracts_status_valid_until_idx
  ON school_contracts(status,valid_until,school_id);

CREATE TABLE school_contract_modules (
  contract_id uuid NOT NULL REFERENCES school_contracts(id) ON DELETE CASCADE,
  module_code text NOT NULL CHECK (module_code IN (
    'SCHOOL_CORE',
    'QUESTION_BANK',
    'SCHOOL_ASSESSMENTS',
    'PATHS_AND_COURSES',
    'INTERACTIVE_VIDEO',
    'SMART_CLASSROOM',
    'SCHOOL_INTELLIGENCE',
    'INTERVENTION_CENTER',
    'LIVE_TUTORING',
    'WHITE_LABEL',
    'EXECUTIVE_ANALYTICS'
  )),
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (contract_id,module_code)
);

CREATE INDEX school_contract_modules_enabled_idx
  ON school_contract_modules(module_code,contract_id)
  WHERE enabled=true;

CREATE TABLE classroom_sessions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','live','ended','archived')),
  day text NOT NULL DEFAULT '' CHECK (char_length(day) <= 40),
  period integer CHECK (period IS NULL OR period BETWEEN 1 AND 12),
  published_mode text NOT NULL DEFAULT 'single'
    CHECK (published_mode IN ('single','batch')),
  active_batch_id uuid,
  active_question_ordinal integer,
  pin_hash text NOT NULL CHECK (pin_hash ~ '^[0-9a-f]{64}$'),
  pin_expires_at timestamptz NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='live' AND started_at IS NOT NULL AND ended_at IS NULL) OR status<>'live'),
  CHECK ((status IN ('ended','archived') AND ended_at IS NOT NULL) OR status NOT IN ('ended','archived'))
);

CREATE UNIQUE INDEX classroom_sessions_one_live_per_class_idx
  ON classroom_sessions(school_id,class_id)
  WHERE status='live';

CREATE INDEX classroom_sessions_teacher_status_idx
  ON classroom_sessions(teacher_id,status,created_at DESC,id DESC);

CREATE INDEX classroom_sessions_school_class_history_idx
  ON classroom_sessions(school_id,class_id,created_at DESC,id DESC);

CREATE INDEX classroom_sessions_pin_idx
  ON classroom_sessions(pin_hash,status,pin_expires_at);

CREATE TABLE classroom_batches (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  session_id uuid NOT NULL REFERENCES classroom_sessions(id) ON DELETE RESTRICT,
  batch_number integer NOT NULL CHECK (batch_number > 0),
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 160),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id,batch_number),
  UNIQUE(id,session_id),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX classroom_batches_session_idx
  ON classroom_batches(session_id,batch_number,id);

CREATE TABLE classroom_questions (
  session_id uuid NOT NULL REFERENCES classroom_sessions(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  batch_id uuid NOT NULL,
  question_id uuid NOT NULL,
  question_version integer NOT NULL CHECK (question_version > 0),
  published_at timestamptz,
  revealed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id,ordinal),
  UNIQUE(session_id,question_id),
  FOREIGN KEY (batch_id,session_id)
    REFERENCES classroom_batches(id,session_id) ON DELETE RESTRICT,
  FOREIGN KEY (question_id,question_version)
    REFERENCES question_versions(question_id,version) ON DELETE RESTRICT,
  CHECK (revealed_at IS NULL OR published_at IS NOT NULL)
);

CREATE INDEX classroom_questions_batch_idx
  ON classroom_questions(session_id,batch_id,ordinal);

CREATE INDEX classroom_questions_question_ref_idx
  ON classroom_questions(question_id,question_version,session_id);

ALTER TABLE classroom_sessions
  ADD CONSTRAINT classroom_sessions_active_batch_fkey
  FOREIGN KEY (active_batch_id,id)
  REFERENCES classroom_batches(id,session_id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE classroom_sessions
  ADD CONSTRAINT classroom_sessions_active_question_fkey
  FOREIGN KEY (id,active_question_ordinal)
  REFERENCES classroom_questions(session_id,ordinal)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE classroom_participants (
  session_id uuid NOT NULL REFERENCES classroom_sessions(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  joined_at timestamptz NOT NULL DEFAULT now(),
  attendance_status text NOT NULL DEFAULT 'present'
    CHECK (attendance_status IN ('present','late','absent','excused')),
  attendance_overridden_by uuid REFERENCES users(id) ON DELETE SET NULL,
  attendance_overridden_at timestamptz,
  PRIMARY KEY (session_id,student_id),
  CHECK (
    (attendance_overridden_by IS NULL AND attendance_overridden_at IS NULL)
    OR
    (attendance_overridden_by IS NOT NULL AND attendance_overridden_at IS NOT NULL)
  )
);

CREATE INDEX classroom_participants_student_idx
  ON classroom_participants(student_id,joined_at DESC,session_id);

CREATE INDEX classroom_participants_session_attendance_idx
  ON classroom_participants(session_id,attendance_status,student_id);

CREATE TABLE classroom_responses (
  session_id uuid NOT NULL,
  question_ordinal integer NOT NULL,
  student_id uuid NOT NULL,
  selected_option_index integer NOT NULL CHECK (selected_option_index >= 0),
  is_correct boolean NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id,question_ordinal,student_id),
  FOREIGN KEY (session_id,question_ordinal)
    REFERENCES classroom_questions(session_id,ordinal) ON DELETE RESTRICT,
  FOREIGN KEY (session_id,student_id)
    REFERENCES classroom_participants(session_id,student_id) ON DELETE RESTRICT
);

CREATE INDEX classroom_responses_session_question_idx
  ON classroom_responses(session_id,question_ordinal,selected_option_index);

CREATE INDEX classroom_responses_student_idx
  ON classroom_responses(student_id,updated_at DESC,session_id);

CREATE TABLE classroom_report_snapshots (
  session_id uuid PRIMARY KEY REFERENCES classroom_sessions(id) ON DELETE RESTRICT,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  finalized_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION prevent_classroom_report_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'classroom report snapshots are immutable';
END;
$$;

CREATE TRIGGER classroom_report_snapshots_immutable
BEFORE UPDATE OR DELETE ON classroom_report_snapshots
FOR EACH ROW
EXECUTE FUNCTION prevent_classroom_report_snapshot_mutation();

COMMIT;
