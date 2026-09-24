BEGIN;

DROP INDEX IF EXISTS auth_otp_challenges_phone_history_idx;

CREATE INDEX auth_otp_challenges_phone_active_idx
  ON auth_otp_challenges(phone, channel, created_at DESC)
  WHERE used_at IS NULL;

COMMIT;
