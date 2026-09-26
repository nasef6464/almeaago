BEGIN;

CREATE TABLE commerce_access_codes (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  code text NOT NULL UNIQUE CHECK (btrim(code) <> '' AND code = upper(code)),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES commerce_products(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  current_uses integer NOT NULL DEFAULT 0 CHECK (current_uses >= 0 AND current_uses <= max_uses),
  starts_at timestamptz,
  expires_at timestamptz NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_access_codes_time_check CHECK (starts_at IS NULL OR expires_at > starts_at)
);

CREATE INDEX commerce_access_codes_school_lifecycle_idx
  ON commerce_access_codes(school_id,status,expires_at,created_at DESC,id DESC);
CREATE INDEX commerce_access_codes_product_lifecycle_idx
  ON commerce_access_codes(product_id,status,expires_at,created_at DESC,id DESC);

CREATE TABLE commerce_school_seats (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES commerce_products(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entitlement_id uuid NOT NULL UNIQUE REFERENCES commerce_entitlements(id) ON DELETE RESTRICT,
  source_type text NOT NULL CHECK (source_type IN ('access_code','admin_assignment')),
  source_id text NOT NULL CHECK (btrim(source_id) <> ''),
  idempotency_key text NOT NULL UNIQUE CHECK (btrim(idempotency_key) <> ''),
  assigned_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX commerce_school_seats_school_product_idx
  ON commerce_school_seats(school_id,product_id,created_at DESC,id DESC);
CREATE INDEX commerce_school_seats_user_idx
  ON commerce_school_seats(user_id,created_at DESC,id DESC);

CREATE TABLE commerce_access_code_redemptions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  access_code_id uuid NOT NULL REFERENCES commerce_access_codes(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES commerce_products(id) ON DELETE RESTRICT,
  seat_id uuid NOT NULL UNIQUE REFERENCES commerce_school_seats(id) ON DELETE RESTRICT,
  entitlement_id uuid NOT NULL UNIQUE REFERENCES commerce_entitlements(id) ON DELETE RESTRICT,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(access_code_id,user_id)
);

CREATE INDEX commerce_access_code_redemptions_user_idx
  ON commerce_access_code_redemptions(user_id,redeemed_at DESC,id DESC);

COMMIT;
