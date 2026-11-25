BEGIN;

CREATE TABLE IF NOT EXISTS platform_integration_settings (
  key text PRIMARY KEY CHECK (key = 'default'),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_integration_settings_updated_by_idx
  ON platform_integration_settings(updated_by)
  WHERE updated_by IS NOT NULL;

INSERT INTO platform_integration_settings (key, settings, revision) VALUES (
  'default',
  '{
    "auth": {
      "allowSelfRegistration": true,
      "allowEmailPassword": true,
      "requireEmailVerification": false,
      "requireAdminApproval": false,
      "defaultRole": "student",
      "registrationTitle": "انضم إلى مجتمع المئة التعليمي",
      "registrationSubtitle": "سجّل حسابك للوصول إلى كافة شروحات وتدريبات قياس",
      "termsLink": "/terms",
      "privacyLink": "/privacy",
      "maxAccountsPerDevice": 3
    },
    "providers": {
      "googleMeet": { "enabled": true, "mode": "oauth", "note": "مربوط للاجتماعات الفردية والجماعية" },
      "zoom": { "enabled": false, "mode": "oauth", "note": "غير مفعل" },
      "teams": { "enabled": false, "mode": "oauth", "note": "غير مفعل" },
      "youtubeLive": { "enabled": false, "mode": "api", "note": "بث الحصص العامة" },
      "googleOAuth": { "enabled": true, "mode": "oauth", "note": "تسجيل الدخول السريع عبر Google" },
      "whatsappOTP": { "enabled": false, "mode": "otp", "note": "التحقق عبر الواتساب" }
    },
    "seo": {
      "siteName": "منصة المئة - قدرات & تحصيلي",
      "defaultTitle": "منصة المئة | المنصة المتكاملة للقدرات والتحصيلي ونافس",
      "defaultDescription": "شروحات تأسيسية وبنك أسئلة ذكي ومحاكاة دقيقة لاختبارات قياس مع المعلم الآلي وتتبع دقيق للمهارات.",
      "canonicalBaseUrl": "https://almeaa.com",
      "googleAnalyticsId": "",
      "googleTagManagerId": "",
      "robotsIndexing": true
    },
    "contactWidget": {
      "enabled": true,
      "channel": "whatsapp",
      "whatsappNumber": "+966500000000",
      "whatsappMessage": "مرحبا، أرغب في الاستفسار عن منصة المعا",
      "openInNewTab": true,
      "showOnPublicPages": true,
      "showOnDashboardPages": true
    }
  }'::jsonb,
  1
) ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS operations_backup_exports (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  title text NOT NULL CHECK (btrim(title) <> '' AND char_length(title) <= 200),
  scope text NOT NULL DEFAULT 'full' CHECK (scope IN ('full')),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(summary) = 'object'),
  total_records integer NOT NULL DEFAULT 0 CHECK (total_records >= 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_email text NOT NULL DEFAULT '' CHECK (char_length(created_by_email) <= 320),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operations_backup_exports_recent_idx
  ON operations_backup_exports(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS operations_backup_exports_created_by_idx
  ON operations_backup_exports(created_by)
  WHERE created_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_school_quotas (
  school_id uuid PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'pro', 'enterprise')),
  token_limit bigint NOT NULL DEFAULT 75000 CHECK (token_limit >= 0),
  tokens_used bigint NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  pdf_exam_limit integer NOT NULL DEFAULT 30 CHECK (pdf_exam_limit >= 0),
  pdf_exams_used integer NOT NULL DEFAULT 0 CHECK (pdf_exams_used >= 0),
  voice_minutes_limit integer NOT NULL DEFAULT 40 CHECK (voice_minutes_limit >= 0),
  voice_minutes_used integer NOT NULL DEFAULT 0 CHECK (voice_minutes_used >= 0),
  whiteboard_enabled boolean NOT NULL DEFAULT false,
  last_reset_at timestamptz,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_school_quotas_tier_updated_idx
  ON ai_school_quotas(tier, updated_at DESC);

CREATE INDEX IF NOT EXISTS ai_school_quotas_updated_by_idx
  ON ai_school_quotas(updated_by)
  WHERE updated_by IS NOT NULL;

COMMIT;
