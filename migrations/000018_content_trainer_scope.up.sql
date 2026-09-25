BEGIN;

CREATE TABLE content_trainer_path_scopes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, path_id)
);

CREATE INDEX content_trainer_path_scopes_path_idx
  ON content_trainer_path_scopes(path_id, user_id);

CREATE TABLE content_trainer_subject_scopes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, subject_id)
);

CREATE INDEX content_trainer_subject_scopes_subject_idx
  ON content_trainer_subject_scopes(subject_id, user_id);

COMMIT;
