BEGIN;

CREATE TABLE classroom_prepared_templates (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (btrim(title) <> ''),
  question_ids uuid[] NOT NULL CHECK (cardinality(question_ids) >= 1 AND cardinality(question_ids) <= 20),
  challenge_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classroom_prepared_templates_challenge_subset CHECK (challenge_ids <@ question_ids)
);

CREATE INDEX classroom_prepared_templates_scope_idx
  ON classroom_prepared_templates(school_id, teacher_id, created_at DESC, id DESC);

COMMIT;
