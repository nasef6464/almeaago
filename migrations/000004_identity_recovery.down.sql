BEGIN;

DROP TABLE IF EXISTS auth_one_time_tokens;

CREATE INDEX IF NOT EXISTS users_login_locked_idx
  ON users(login_locked_until)
  WHERE login_locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS auth_sessions_token_active_idx
  ON auth_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

COMMIT;
