BEGIN;
CREATE TABLE content_platform_font_settings (
 key text PRIMARY KEY CHECK (key = 'default'),
 settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
