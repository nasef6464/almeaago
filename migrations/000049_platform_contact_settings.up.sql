CREATE TABLE IF NOT EXISTS content_platform_contact_settings (
  key text PRIMARY KEY CHECK (key = 'default'),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO content_platform_contact_settings(key, settings) VALUES (
  'default',
  '{
    "enabled": true,
    "channel": "whatsapp",
    "whatsappNumber": "+966500000000",
    "whatsappMessage": "مرحبا، أرغب في الاستفسار عن منصة المعا",
    "openInNewTab": true,
    "showOnPublicPages": true,
    "showOnDashboardPages": true
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;
