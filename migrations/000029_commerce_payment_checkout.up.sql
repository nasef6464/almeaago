BEGIN;

CREATE TABLE commerce_discount_codes (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  code text NOT NULL UNIQUE CHECK (code = upper(code) AND btrim(code) <> ''),
  label text NOT NULL DEFAULT '',
  discount_type text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  percentage_bps integer NOT NULL DEFAULT 0 CHECK (percentage_bps BETWEEN 0 AND 10000),
  fixed_minor bigint NOT NULL DEFAULT 0 CHECK (fixed_minor >= 0),
  currency text NOT NULL DEFAULT 'SAR' CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','expired')),
  product_id uuid REFERENCES commerce_products(id) ON DELETE RESTRICT,
  product_type text CHECK (product_type IS NULL OR product_type IN ('course','package','membership')),
  min_amount_minor bigint NOT NULL DEFAULT 0 CHECK (min_amount_minor >= 0),
  max_redemptions integer NOT NULL DEFAULT 0 CHECK (max_redemptions >= 0),
  current_redemptions integer NOT NULL DEFAULT 0 CHECK (current_redemptions >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_discount_value_shape CHECK (
    (discount_type='percentage' AND percentage_bps > 0 AND fixed_minor=0)
    OR (discount_type='fixed' AND percentage_bps=0 AND fixed_minor > 0)
  ),
  CONSTRAINT commerce_discount_window_check CHECK (
    expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at
  ),
  CONSTRAINT commerce_discount_redemption_check CHECK (
    max_redemptions=0 OR current_redemptions <= max_redemptions
  )
);

CREATE INDEX commerce_discount_codes_active_idx
  ON commerce_discount_codes(status,starts_at,expires_at,code);
CREATE INDEX commerce_discount_codes_product_idx
  ON commerce_discount_codes(product_id,status)
  WHERE product_id IS NOT NULL;
CREATE INDEX commerce_discount_codes_type_idx
  ON commerce_discount_codes(product_type,status)
  WHERE product_type IS NOT NULL;

CREATE TABLE commerce_payment_requests (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES commerce_products(id) ON DELETE RESTRICT,
  product_revision integer NOT NULL CHECK (product_revision > 0),
  product_name text NOT NULL CHECK (btrim(product_name) <> ''),
  product_type text NOT NULL CHECK (product_type IN ('course','package','membership')),
  original_amount_minor bigint NOT NULL CHECK (original_amount_minor > 0),
  discount_amount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0),
  final_amount_minor bigint NOT NULL CHECK (final_amount_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  discount_code_id uuid REFERENCES commerce_discount_codes(id) ON DELETE RESTRICT,
  discount_code text NOT NULL DEFAULT '',
  payment_method text NOT NULL CHECK (payment_method IN ('card','transfer','wallet')),
  provider_code text NOT NULL CHECK (btrim(provider_code) <> ''),
  gateway_mode text NOT NULL CHECK (gateway_mode IN ('manual_review','payment_link','webhook')),
  payment_country text NOT NULL CHECK (payment_country ~ '^[A-Z]{2,3}$'),
  transfer_reference text NOT NULL DEFAULT '',
  wallet_number text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewer_notes text NOT NULL DEFAULT '',
  approval_evidence text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  provider_transaction_id text NOT NULL DEFAULT '',
  provider_event_id text NOT NULL DEFAULT '',
  paid_at timestamptz,
  idempotency_key text NOT NULL UNIQUE CHECK (btrim(idempotency_key) <> ''),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_payment_amount_check CHECK (
    discount_amount_minor <= original_amount_minor
    AND final_amount_minor = original_amount_minor - discount_amount_minor
  ),
  CONSTRAINT commerce_payment_review_shape CHECK (
    (status='pending' AND reviewed_at IS NULL)
    OR (status<>'pending' AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX commerce_payment_requests_user_recent_idx
  ON commerce_payment_requests(user_id,created_at DESC,id DESC);
CREATE INDEX commerce_payment_requests_status_recent_idx
  ON commerce_payment_requests(status,created_at DESC,id DESC);
CREATE INDEX commerce_payment_requests_product_idx
  ON commerce_payment_requests(product_id,status,created_at DESC,id DESC);
CREATE INDEX commerce_payment_requests_discount_idx
  ON commerce_payment_requests(discount_code_id,status)
  WHERE discount_code_id IS NOT NULL;

CREATE TABLE commerce_provider_events (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  provider_code text NOT NULL CHECK (btrim(provider_code) <> ''),
  event_id text NOT NULL CHECK (btrim(event_id) <> ''),
  payment_request_id uuid NOT NULL REFERENCES commerce_payment_requests(id) ON DELETE RESTRICT,
  event_status text NOT NULL CHECK (event_status IN ('paid','failed','cancelled')),
  transaction_id text NOT NULL DEFAULT '',
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  signature_verified boolean NOT NULL DEFAULT true CHECK (signature_verified=true),
  processing_status text NOT NULL CHECK (processing_status IN ('applied','ignored','rejected')),
  processing_reason text NOT NULL DEFAULT '',
  occurred_at timestamptz,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_code,event_id)
);

CREATE INDEX commerce_provider_events_request_idx
  ON commerce_provider_events(payment_request_id,created_at DESC,id DESC);
CREATE INDEX commerce_provider_events_transaction_idx
  ON commerce_provider_events(provider_code,transaction_id)
  WHERE transaction_id <> '';

COMMIT;
