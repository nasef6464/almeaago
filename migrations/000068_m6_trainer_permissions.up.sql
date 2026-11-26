BEGIN;

CREATE TABLE IF NOT EXISTS content_trainer_permissions (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
