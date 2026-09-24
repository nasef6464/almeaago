BEGIN;

ALTER TABLE users
  ADD COLUMN avatar_url text NOT NULL DEFAULT '',
  ADD COLUMN national_id text,
  ADD COLUMN phone text,
  ADD COLUMN email_verified_at timestamptz,
  ADD COLUMN password_changed_at timestamptz,
  ADD COLUMN failed_login_attempts integer NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  ADD COLUMN last_failed_login_at timestamptz,
  ADD COLUMN login_locked_until timestamptz;

CREATE UNIQUE INDEX users_national_id_unique
  ON users(national_id)
  WHERE national_id IS NOT NULL AND national_id <> '';

CREATE UNIQUE INDEX users_phone_unique
  ON users(phone)
  WHERE phone IS NOT NULL AND phone <> '';

CREATE INDEX users_login_locked_idx
  ON users(login_locked_until)
  WHERE login_locked_until IS NOT NULL;

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student','teacher','admin','supervisor','school_admin','parent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

CREATE INDEX user_roles_role_idx ON user_roles(role, user_id);

ALTER TABLE auth_sessions
  ADD COLUMN csrf_token_hash text NOT NULL DEFAULT '',
  ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE auth_sessions ALTER COLUMN csrf_token_hash DROP DEFAULT;

CREATE INDEX auth_sessions_token_active_idx
  ON auth_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

COMMIT;
