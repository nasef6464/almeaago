BEGIN;

DROP TABLE IF EXISTS notification_preferences;
DROP INDEX IF EXISTS notification_campaigns_idempotency_key_uidx;
ALTER TABLE notification_campaigns DROP COLUMN IF EXISTS idempotency_key;

COMMIT;
