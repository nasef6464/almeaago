BEGIN;

ALTER TABLE ai_interactions
  ADD COLUMN cached_tokens integer NOT NULL DEFAULT 0 CHECK (cached_tokens >= 0);

ALTER TABLE ai_interactions
  DROP CONSTRAINT ai_interactions_capability_check,
  ADD CONSTRAINT ai_interactions_capability_check
    CHECK (capability IN ('question_tutor','provider_health','admin_status','admin_copilot'));

CREATE TABLE ai_usage_daily (
  day_key date NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('global','user','capability')),
  scope_id text NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  input_tokens bigint NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens bigint NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens bigint NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  cached_tokens bigint NOT NULL DEFAULT 0 CHECK (cached_tokens >= 0),
  fallback_count integer NOT NULL DEFAULT 0 CHECK (fallback_count >= 0),
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(day_key,scope_type,scope_id)
);

CREATE INDEX ai_usage_daily_scope_recent_idx
  ON ai_usage_daily(scope_type,scope_id,day_key DESC);

COMMIT;
