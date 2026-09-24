BEGIN;

ALTER TABLE users
  ADD COLUMN avatar_url text NOT NULL DEFAULT '',
  ADD COLUMN email_verified_at timestamptz,
  ADD COLUMN national_id text,
  ADD COLUMN phone text,
  ADD COLUMN failed_login_attempts integer NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  ADD COLUMN last_failed_login_at timestamptz,
  ADD COLUMN login_locked_until timestamptz,
  ADD COLUMN password_changed_at timestamptz;

CREATE UNIQUE INDEX users_national_id_unique
  ON users(national_id)
  WHERE national_id IS NOT NULL AND btrim(national_id) <> '';

CREATE UNIQUE INDEX users_phone_unique
  ON users(phone)
  WHERE phone IS NOT NULL AND btrim(phone) <> '';

CREATE INDEX users_login_locked_idx
  ON users(login_locked_until)
  WHERE login_locked_until IS NOT NULL;

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student','teacher','admin','supervisor','school_admin','parent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE auth_sessions
  ADD COLUMN user_agent text NOT NULL DEFAULT '',
  ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX auth_sessions_active_lookup_idx
  ON auth_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE auth_tokens (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('email_verification','password_reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_tokens_user_purpose_idx
  ON auth_tokens(user_id, purpose, expires_at DESC);

CREATE INDEX auth_tokens_active_idx
  ON auth_tokens(purpose, token_hash, expires_at)
  WHERE used_at IS NULL;

COMMIT;
