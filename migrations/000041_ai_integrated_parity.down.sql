BEGIN;

DROP TABLE IF EXISTS ai_usage_daily;

ALTER TABLE ai_interactions
  DROP CONSTRAINT IF EXISTS ai_interactions_capability_check;

ALTER TABLE ai_interactions
  ADD CONSTRAINT ai_interactions_capability_check
    CHECK (capability IN ('question_tutor','provider_health','admin_status'));

ALTER TABLE ai_interactions
  DROP COLUMN IF EXISTS cached_tokens;

COMMIT;
