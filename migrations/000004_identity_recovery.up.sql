BEGIN;

CREATE TABLE auth_one_time_tokens (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('email_verification','password_reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_one_time_tokens_user_purpose_idx
  ON auth_one_time_tokens(user_id, purpose, created_at DESC);

CREATE INDEX auth_one_time_tokens_expiry_idx
  ON auth_one_time_tokens(expires_at)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

COMMIT;
