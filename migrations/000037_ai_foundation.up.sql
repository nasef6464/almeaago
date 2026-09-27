BEGIN;

CREATE TABLE ai_provider_settings (
  provider text PRIMARY KEY
    CHECK (provider IN ('gemini','openrouter','qwen','deepseek','openai','ollama','lmstudio')),
  enabled boolean NOT NULL DEFAULT false,
  model text NOT NULL DEFAULT ''
    CHECK (char_length(model) <= 200),
  base_url text NOT NULL DEFAULT ''
    CHECK (char_length(base_url) <= 500),
  priority integer NOT NULL DEFAULT 100
    CHECK (priority BETWEEN 1 AND 1000),
  max_output_tokens integer NOT NULL DEFAULT 800
    CHECK (max_output_tokens BETWEEN 64 AND 4000),
  revision integer NOT NULL DEFAULT 1
    CHECK (revision > 0),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ai_provider_settings(provider,enabled,model,base_url,priority,max_output_tokens)
VALUES
  ('gemini',false,'gemini-2.5-flash','https://generativelanguage.googleapis.com',10,800),
  ('openrouter',false,'qwen/qwen3-235b-a22b:free','https://openrouter.ai/api/v1',20,800),
  ('qwen',false,'qwen-plus','https://dashscope-intl.aliyuncs.com/compatible-mode/v1',30,800),
  ('deepseek',false,'deepseek-chat','https://api.deepseek.com',40,800),
  ('openai',false,'gpt-4.1-mini','https://api.openai.com/v1',50,800),
  ('ollama',false,'gemma3:4b','',60,800),
  ('lmstudio',false,'local-model','',70,800);

CREATE UNIQUE INDEX ai_provider_settings_priority_idx
  ON ai_provider_settings(priority);

CREATE TABLE ai_provider_health (
  provider text PRIMARY KEY REFERENCES ai_provider_settings(provider) ON DELETE CASCADE,
  consecutive_failures integer NOT NULL DEFAULT 0
    CHECK (consecutive_failures >= 0),
  open_until timestamptz,
  last_error text NOT NULL DEFAULT ''
    CHECK (char_length(last_error) <= 500),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_interactions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  audience text NOT NULL DEFAULT 'guest'
    CHECK (audience IN ('student','admin','teacher','supervisor','school_admin','parent','guest','system')),
  endpoint text NOT NULL DEFAULT ''
    CHECK (char_length(endpoint) <= 120),
  capability text NOT NULL DEFAULT ''
    CHECK (char_length(capability) <= 80),
  provider text NOT NULL DEFAULT 'none'
    CHECK (provider IN ('gemini','openrouter','qwen','deepseek','openai','ollama','lmstudio','none')),
  model text NOT NULL DEFAULT ''
    CHECK (char_length(model) <= 200),
  status text NOT NULL
    CHECK (status IN ('success','fallback','error')),
  used_fallback boolean NOT NULL DEFAULT false,
  cache_hit boolean NOT NULL DEFAULT false,
  question_id uuid,
  question_version integer,
  review_card_id uuid REFERENCES review_cards(id) ON DELETE SET NULL,
  prompt_version text NOT NULL DEFAULT ''
    CHECK (char_length(prompt_version) <= 80),
  latency_ms integer NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens integer NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  usage_estimated boolean NOT NULL DEFAULT false,
  response_length integer NOT NULL DEFAULT 0 CHECK (response_length >= 0),
  error_category text NOT NULL DEFAULT ''
    CHECK (char_length(error_category) <= 160),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata)='object'),
  retention_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (question_id,question_version)
    REFERENCES question_versions(question_id,version) ON DELETE SET NULL,
  CHECK ((question_id IS NULL AND question_version IS NULL) OR (question_id IS NOT NULL AND question_version IS NOT NULL))
);

CREATE INDEX ai_interactions_created_idx
  ON ai_interactions(created_at DESC,id DESC);

CREATE INDEX ai_interactions_provider_status_idx
  ON ai_interactions(provider,status,created_at DESC,id DESC);

CREATE INDEX ai_interactions_user_question_idx
  ON ai_interactions(user_id,question_id,created_at DESC,id DESC)
  WHERE user_id IS NOT NULL AND question_id IS NOT NULL;

CREATE INDEX ai_interactions_retention_idx
  ON ai_interactions(retention_until)
  WHERE retention_until IS NOT NULL;

CREATE TABLE ai_question_assist_cache (
  cache_key char(64) PRIMARY KEY
    CHECK (cache_key ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_card_id uuid NOT NULL REFERENCES review_cards(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  question_version integer NOT NULL CHECK (question_version > 0),
  help_level text NOT NULL
    CHECK (help_level IN ('hint','stronger_hint','concept','steps','follow_up')),
  prompt_version text NOT NULL
    CHECK (btrim(prompt_version) <> '' AND char_length(prompt_version) <= 80),
  response_text text NOT NULL
    CHECK (btrim(response_text) <> '' AND char_length(response_text) <= 4000),
  provider text NOT NULL DEFAULT 'none'
    CHECK (provider IN ('gemini','openrouter','qwen','deepseek','openai','ollama','lmstudio','none')),
  model text NOT NULL DEFAULT ''
    CHECK (char_length(model) <= 200),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (question_id,question_version)
    REFERENCES question_versions(question_id,version) ON DELETE CASCADE
);

CREATE INDEX ai_question_assist_cache_expiry_idx
  ON ai_question_assist_cache(expires_at);

CREATE INDEX ai_question_assist_cache_user_question_idx
  ON ai_question_assist_cache(user_id,question_id,created_at DESC);

COMMIT;
