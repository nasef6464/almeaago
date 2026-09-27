BEGIN;

CREATE TABLE notification_templates (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  key text NOT NULL UNIQUE
    CHECK (key ~ '^[A-Za-z0-9_.-]{2,80}$'),
  name text NOT NULL
    CHECK (btrim(name) <> '' AND char_length(name) <= 160),
  channel text NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app','email','whatsapp')),
  subject text NOT NULL DEFAULT ''
    CHECK (char_length(subject) <= 220),
  title text NOT NULL
    CHECK (btrim(title) <> '' AND char_length(title) <= 220),
  body text NOT NULL
    CHECK (btrim(body) <> '' AND char_length(body) <= 4000),
  variables text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_template_variables_shape CHECK (cardinality(variables) <= 50)
);

CREATE INDEX notification_templates_active_channel_idx
  ON notification_templates(is_active,channel,updated_at DESC,id DESC);

CREATE TABLE notification_campaigns (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  template_id uuid REFERENCES notification_templates(id) ON DELETE SET NULL,
  template_key text NOT NULL DEFAULT '',
  title text NOT NULL CHECK (btrim(title) <> '' AND char_length(title) <= 220),
  subject text NOT NULL DEFAULT '' CHECK (char_length(subject) <= 220),
  body text NOT NULL CHECK (btrim(body) <> '' AND char_length(body) <= 4000),
  channels text[] NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  delivery_count integer NOT NULL DEFAULT 0 CHECK (delivery_count >= 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_campaign_channels_shape CHECK (
    cardinality(channels) BETWEEN 1 AND 3
    AND channels <@ ARRAY['in_app','email','whatsapp']::text[]
  )
);

CREATE INDEX notification_campaigns_created_idx
  ON notification_campaigns(created_at DESC,id DESC);

CREATE TABLE notification_deliveries (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  campaign_id uuid NOT NULL REFERENCES notification_campaigns(id) ON DELETE RESTRICT,
  template_key text NOT NULL DEFAULT '',
  channel text NOT NULL CHECK (channel IN ('in_app','email','whatsapp')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','retrying','failed')),
  title text NOT NULL CHECK (btrim(title) <> '' AND char_length(title) <= 220),
  subject text NOT NULL DEFAULT '' CHECK (char_length(subject) <= 220),
  body text NOT NULL CHECK (btrim(body) <> '' AND char_length(body) <= 4000),
  recipient_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL DEFAULT '',
  recipient_phone text NOT NULL DEFAULT '',
  provider text NOT NULL DEFAULT '',
  provider_message_id text NOT NULL DEFAULT '',
  failure_reason text NOT NULL DEFAULT '',
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 4),
  next_attempt_at timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id,recipient_user_id,channel),
  CONSTRAINT notification_delivery_state_shape CHECK (
    (channel='in_app' AND status='sent' AND provider='internal' AND sent_at IS NOT NULL AND next_attempt_at IS NULL)
    OR
    (channel IN ('email','whatsapp') AND status='pending' AND sent_at IS NULL)
    OR
    (channel IN ('email','whatsapp') AND status='retrying' AND sent_at IS NULL AND next_attempt_at IS NOT NULL)
    OR
    (channel IN ('email','whatsapp') AND status='failed' AND sent_at IS NULL)
    OR
    (channel IN ('email','whatsapp') AND status='sent' AND sent_at IS NOT NULL)
  )
);

CREATE INDEX notification_deliveries_inbox_idx
  ON notification_deliveries(recipient_user_id,created_at DESC,id DESC)
  WHERE channel='in_app' AND status='sent';

CREATE INDEX notification_deliveries_unread_idx
  ON notification_deliveries(recipient_user_id,created_at DESC,id DESC)
  WHERE channel='in_app' AND status='sent' AND read_at IS NULL;

CREATE INDEX notification_deliveries_worker_idx
  ON notification_deliveries(status,channel,next_attempt_at,created_at,id)
  WHERE channel IN ('email','whatsapp') AND status IN ('pending','retrying');

CREATE INDEX notification_deliveries_campaign_idx
  ON notification_deliveries(campaign_id,status,created_at DESC,id DESC);

CREATE INDEX notification_deliveries_admin_idx
  ON notification_deliveries(status,channel,created_at DESC,id DESC);

COMMIT;
