BEGIN;

CREATE TABLE commerce_discount_codes (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{1,79}$'),
  label text NOT NULL DEFAULT '',
  discount_type text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  percentage_bps integer,
  fixed_minor bigint,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','expired')),
  min_amount_minor bigint NOT NULL DEFAULT 0 CHECK (min_amount_minor >= 0),
  max_redemptions integer NOT NULL DEFAULT 0 CHECK (max_redemptions >= 0),
  reserved_count integer NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  redeemed_count integer NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_discount_value_shape CHECK (
    (discount_type='percentage' AND percentage_bps BETWEEN 1 AND 10000 AND fixed_minor IS NULL)
    OR
    (discount_type='fixed' AND fixed_minor > 0 AND percentage_bps IS NULL)
  ),
  CONSTRAINT commerce_discount_time_check CHECK (
    expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at
  )
);

CREATE INDEX commerce_discount_codes_status_idx
  ON commerce_discount_codes(status,starts_at,expires_at,updated_at DESC,id DESC);

CREATE TABLE commerce_discount_scopes (
  discount_id uuid NOT NULL REFERENCES commerce_discount_codes(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('all','product','product_type')),
  product_id uuid REFERENCES commerce_products(id) ON DELETE RESTRICT,
  product_type text CHECK (product_type IS NULL OR product_type IN ('course','package','membership')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_discount_scope_shape CHECK (
    (scope_type='all' AND product_id IS NULL AND product_type IS NULL)
    OR
    (scope_type='product' AND product_id IS NOT NULL AND product_type IS NULL)
    OR
    (scope_type='product_type' AND product_id IS NULL AND product_type IS NOT NULL)
  )
);

CREATE UNIQUE INDEX commerce_discount_scopes_unique_idx
  ON commerce_discount_scopes(
    discount_id,
    scope_type,
    COALESCE(product_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(product_type,'')
  );

CREATE INDEX commerce_discount_scopes_product_idx
  ON commerce_discount_scopes(product_id,discount_id)
  WHERE product_id IS NOT NULL;

CREATE TABLE commerce_payment_requests (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES commerce_products(id) ON DELETE RESTRICT,
  product_revision integer NOT NULL CHECK (product_revision > 0),
  product_name text NOT NULL CHECK (btrim(product_name) <> ''),
  original_amount_minor bigint NOT NULL CHECK (original_amount_minor > 0),
  discount_amount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0),
  final_amount_minor bigint NOT NULL CHECK (final_amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  discount_id uuid REFERENCES commerce_discount_codes(id) ON DELETE RESTRICT,
  discount_code text NOT NULL DEFAULT '',
  payment_method text NOT NULL CHECK (payment_method IN ('card','transfer','wallet')),
  gateway_mode text NOT NULL DEFAULT 'manual_review' CHECK (gateway_mode IN ('manual_review','webhook')),
  provider_code text NOT NULL CHECK (btrim(provider_code) <> ''),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected','cancelled','failed')),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  provider_transaction_id text NOT NULL DEFAULT '',
  paid_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reviewer_notes text NOT NULL DEFAULT '',
  approval_evidence text NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_payment_amount_check CHECK (
    discount_amount_minor <= original_amount_minor
    AND final_amount_minor = original_amount_minor - discount_amount_minor
  ),
  CONSTRAINT commerce_payment_paid_shape CHECK (
    (status='paid' AND paid_at IS NOT NULL)
    OR
    (status<>'paid' AND paid_at IS NULL)
  ),
  CONSTRAINT commerce_payment_review_shape CHECK (
    reviewed_at IS NULL OR reviewed_by IS NOT NULL
  )
);

CREATE UNIQUE INDEX commerce_payment_requests_user_idempotency_idx
  ON commerce_payment_requests(user_id,idempotency_key);

CREATE INDEX commerce_payment_requests_user_idx
  ON commerce_payment_requests(user_id,created_at DESC,id DESC);

CREATE INDEX commerce_payment_requests_admin_idx
  ON commerce_payment_requests(status,created_at DESC,id DESC);

CREATE INDEX commerce_payment_requests_product_idx
  ON commerce_payment_requests(product_id,status,created_at DESC,id DESC);

CREATE TABLE commerce_discount_redemptions (
  discount_id uuid NOT NULL REFERENCES commerce_discount_codes(id) ON DELETE RESTRICT,
  payment_request_id uuid NOT NULL UNIQUE REFERENCES commerce_payment_requests(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','redeemed','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(discount_id,payment_request_id)
);

CREATE INDEX commerce_discount_redemptions_discount_idx
  ON commerce_discount_redemptions(discount_id,status,created_at DESC);

CREATE TABLE commerce_provider_events (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  provider_code text NOT NULL CHECK (btrim(provider_code) <> ''),
  event_id text NOT NULL CHECK (btrim(event_id) <> ''),
  payment_request_id uuid NOT NULL REFERENCES commerce_payment_requests(id) ON DELETE RESTRICT,
  transaction_id text NOT NULL DEFAULT '',
  event_status text NOT NULL CHECK (event_status IN ('paid','failed','cancelled')),
  amount_minor bigint CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  processing_result text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE UNIQUE INDEX commerce_provider_events_provider_event_unique_idx
  ON commerce_provider_events(provider_code,event_id);

CREATE INDEX commerce_provider_events_request_idx
  ON commerce_provider_events(payment_request_id,created_at DESC,id DESC);

COMMIT;
