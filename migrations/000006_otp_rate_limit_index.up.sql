BEGIN;

DROP INDEX IF EXISTS auth_otp_challenges_phone_active_idx;

CREATE INDEX auth_otp_challenges_phone_history_idx
  ON auth_otp_challenges(phone, channel, created_at DESC);

COMMIT;
