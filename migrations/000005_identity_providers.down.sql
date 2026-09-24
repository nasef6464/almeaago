BEGIN;

DROP TABLE IF EXISTS auth_otp_challenges;
DROP TABLE IF EXISTS auth_provider_identities;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_has_login_identity;

DROP INDEX IF EXISTS users_email_unique_ci;

CREATE UNIQUE INDEX users_email_unique_ci
  ON users(lower(email));

ALTER TABLE users
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN password_hash SET NOT NULL;

COMMIT;
