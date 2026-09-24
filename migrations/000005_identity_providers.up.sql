BEGIN;

ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL;

DROP INDEX IF EXISTS users_email_unique_ci;

CREATE UNIQUE INDEX users_email_unique_ci
  ON users(lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';

ALTER TABLE users
  ADD CONSTRAINT users_has_login_identity
  CHECK (
    (email IS NOT NULL AND btrim(email) <> '')
    OR (phone IS NOT NULL AND btrim(phone) <> '')
  );

CREATE TABLE auth_provider_identities (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','whatsapp')),
  provider_subject text NOT NULL,
  verified_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_subject)
);

CREATE INDEX auth_provider_identities_user_idx
  ON auth_provider_identities(user_id, provider);

CREATE TABLE auth_otp_challenges (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  phone text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp')),
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_otp_challenges_phone_active_idx
  ON auth_otp_challenges(phone, channel, created_at DESC)
  WHERE used_at IS NULL;

COMMIT;
