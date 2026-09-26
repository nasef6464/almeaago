BEGIN;

CREATE TABLE lesson_progress (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  context_type text NOT NULL CHECK (context_type IN ('course','foundation')),
  course_id uuid REFERENCES courses(id) ON DELETE RESTRICT,
  topic_id uuid REFERENCES foundation_topics(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  completed_at timestamptz,
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_progress_context_shape CHECK (
    (context_type='course' AND course_id IS NOT NULL AND topic_id IS NULL)
    OR
    (context_type='foundation' AND course_id IS NULL AND topic_id IS NOT NULL)
  ),
  CONSTRAINT lesson_progress_completed_shape CHECK (
    (status='completed' AND completed_at IS NOT NULL)
    OR
    (status='in_progress' AND completed_at IS NULL)
  )
);

CREATE UNIQUE INDEX lesson_progress_student_context_unique_idx
  ON lesson_progress(
    student_id,
    lesson_id,
    context_type,
    COALESCE(course_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(topic_id,'00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX lesson_progress_student_course_recent_idx
  ON lesson_progress(student_id,course_id,updated_at DESC,id DESC)
  WHERE course_id IS NOT NULL;

CREATE INDEX lesson_progress_student_topic_recent_idx
  ON lesson_progress(student_id,topic_id,updated_at DESC,id DESC)
  WHERE topic_id IS NOT NULL;

CREATE TABLE lesson_video_progress (
  lesson_progress_id uuid PRIMARY KEY REFERENCES lesson_progress(id) ON DELETE RESTRICT,
  position_seconds integer NOT NULL DEFAULT 0 CHECK (position_seconds >= 0 AND position_seconds <= 86400),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
