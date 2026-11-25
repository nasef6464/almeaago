BEGIN;

CREATE TABLE session_bookings (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_key text NOT NULL CHECK (char_length(btrim(request_key)) BETWEEN 8 AND 100),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 240),
  target_label text NOT NULL DEFAULT '' CHECK (char_length(target_label) <= 240),
  scheduled_date date NOT NULL,
  scheduled_time text NOT NULL CHECK (char_length(btrim(scheduled_time)) BETWEEN 3 AND 40),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  path_id uuid REFERENCES paths(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES levels(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  section_id uuid REFERENCES taxonomy_skill_sections(id) ON DELETE SET NULL,
  skill_ids uuid[] NOT NULL DEFAULT '{}',
  booking_status text NOT NULL DEFAULT 'pending' CHECK (booking_status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_teacher_name text NOT NULL DEFAULT '' CHECK (char_length(assigned_teacher_name) <= 160),
  session_id uuid REFERENCES classroom_sessions(id) ON DELETE SET NULL,
  admin_notes text NOT NULL DEFAULT '' CHECK (char_length(admin_notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_bookings_user_request_key_uidx UNIQUE (user_id, request_key)
);

CREATE INDEX session_bookings_user_created_idx ON session_bookings(user_id, created_at DESC);
CREATE INDEX session_bookings_teacher_status_idx ON session_bookings(teacher_id, booking_status, created_at DESC) WHERE teacher_id IS NOT NULL;
CREATE INDEX session_bookings_status_created_idx ON session_bookings(booking_status, created_at DESC);

CREATE TABLE course_qa_questions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  path_id uuid REFERENCES paths(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id text NOT NULL CHECK (request_id ~ '^[A-Za-z0-9_-]{8,128}$'),
  subject_name text NOT NULL DEFAULT '' CHECK (char_length(subject_name) <= 160),
  question text NOT NULL CHECK (char_length(btrim(question)) BETWEEN 2 AND 2000),
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_qa_questions_author_request_uidx UNIQUE (author_id, request_id)
);

CREATE INDEX course_qa_questions_course_created_idx ON course_qa_questions(course_id, created_at DESC) WHERE course_id IS NOT NULL;
CREATE INDEX course_qa_questions_created_idx ON course_qa_questions(created_at DESC, id DESC);

CREATE TABLE course_qa_replies (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  question_id uuid NOT NULL REFERENCES course_qa_questions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id text NOT NULL CHECK (request_id ~ '^[A-Za-z0-9_-]{8,128}$'),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  is_instructor boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_qa_replies_question_author_request_uidx UNIQUE (question_id, author_id, request_id)
);

CREATE INDEX course_qa_replies_question_created_idx ON course_qa_replies(question_id, created_at ASC, id ASC);

CREATE TABLE course_certificates (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  verification_code text NOT NULL UNIQUE CHECK (char_length(btrim(verification_code)) BETWEEN 6 AND 80),
  issued_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_certificates_user_course_uidx UNIQUE (user_id, course_id)
);

CREATE INDEX course_certificates_user_issued_idx ON course_certificates(user_id, issued_at DESC);

COMMIT;
