BEGIN;

-- Remove speculative indexes from the core slice. The unique token_hash index
-- already makes session lookup O(log N), and account-lock checks happen after
-- indexed user lookup rather than by scanning locked accounts.
DROP INDEX IF EXISTS auth_sessions_token_active_idx;
DROP INDEX IF EXISTS users_login_locked_idx;

CREATE TABLE auth_one_time_tokens (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('password_reset','email_verification')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- token_hash already has a unique B-tree index. The hot write/query we need
-- another index for is invalidating the active token for a user + purpose.
CREATE INDEX auth_one_time_tokens_user_active_idx
  ON auth_one_time_tokens(user_id, purpose)
  WHERE used_at IS NULL;

COMMIT;
