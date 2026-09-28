BEGIN;

ALTER TABLE notification_campaigns
  ADD COLUMN idempotency_key text
    CHECK (idempotency_key IS NULL OR (char_length(idempotency_key) BETWEEN 1 AND 200));

CREATE UNIQUE INDEX notification_campaigns_idempotency_key_uidx
  ON notification_campaigns(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  parent_whatsapp_digest_enabled boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_preferences_parent_whatsapp_idx
  ON notification_preferences(user_id)
  WHERE parent_whatsapp_digest_enabled = true;

COMMIT;
