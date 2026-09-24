BEGIN;

ALTER TABLE auth_sessions
  DROP COLUMN IF EXISTS last_seen_at,
  DROP COLUMN IF EXISTS csrf_token_hash;

DROP TABLE IF EXISTS user_roles;

DROP INDEX IF EXISTS users_login_locked_idx;
DROP INDEX IF EXISTS users_phone_unique;
DROP INDEX IF EXISTS users_national_id_unique;

ALTER TABLE users
  DROP COLUMN IF EXISTS login_locked_until,
  DROP COLUMN IF EXISTS last_failed_login_at,
  DROP COLUMN IF EXISTS failed_login_attempts,
  DROP COLUMN IF EXISTS password_changed_at,
  DROP COLUMN IF EXISTS email_verified_at,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS national_id,
  DROP COLUMN IF EXISTS avatar_url;

COMMIT;
