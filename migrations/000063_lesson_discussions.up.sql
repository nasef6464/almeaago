BEGIN;
CREATE TABLE lesson_discussion_messages (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id),
  parent_id uuid REFERENCES lesson_discussion_messages(id),
  request_id text NOT NULL CHECK (request_id ~ '^[A-Za-z0-9_-]{16,128}$'),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, lesson_id, author_id, request_id)
);
CREATE INDEX lesson_discussion_scope_order_idx ON lesson_discussion_messages(course_id, lesson_id, created_at, id);
COMMIT;
