BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  status text NOT NULL DEFAULT 'success'
    CHECK (status IN ('success','blocked','failed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_actor_created_idx
  ON audit_logs(actor_user_id, created_at DESC)
  WHERE actor_user_id IS NOT NULL;

CREATE INDEX audit_logs_resource_created_idx
  ON audit_logs(resource_type, resource_id, created_at DESC);

CREATE INDEX users_created_desc_idx
  ON users(created_at DESC, id);

CREATE INDEX users_status_created_idx
  ON users(status, created_at DESC, id);

CREATE INDEX users_name_trgm_idx
  ON users USING gin (lower(name) gin_trgm_ops);

CREATE INDEX users_email_trgm_idx
  ON users USING gin (lower(email) gin_trgm_ops)
  WHERE email IS NOT NULL AND btrim(email) <> '';

COMMIT;
