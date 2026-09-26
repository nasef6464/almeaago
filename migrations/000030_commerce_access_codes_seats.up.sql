BEGIN;

CREATE TABLE commerce_access_codes (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  code text NOT NULL UNIQUE CHECK (code = upper(btrim(code)) AND code ~ '^[A-Z0-9][A-Z0-9_-]{3,79}$'),
  product_id uuid NOT NULL REFERENCES commerce_products(id) ON DELETE RESTRICT,
  school_id uuid REFERENCES schools(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  max_uses integer NOT NULL CHECK (max_uses > 0),
  current_uses integer NOT NULL DEFAULT 0 CHECK (current_uses >= 0 AND current_uses <= max_uses),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_access_codes_window_check CHECK (expires_at > starts_at)
);

CREATE INDEX commerce_access_codes_admin_idx
  ON commerce_access_codes(status,updated_at DESC,id DESC);
CREATE INDEX commerce_access_codes_product_idx
  ON commerce_access_codes(product_id,status,expires_at);

CREATE TABLE commerce_access_code_redemptions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  access_code_id uuid NOT NULL REFERENCES commerce_access_codes(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entitlement_id uuid NOT NULL UNIQUE REFERENCES commerce_entitlements(id) ON DELETE RESTRICT,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(access_code_id,user_id)
);

CREATE INDEX commerce_access_code_redemptions_user_idx
  ON commerce_access_code_redemptions(user_id,redeemed_at DESC,id DESC);

CREATE TABLE commerce_school_seat_assignments (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  school_entitlement_id uuid NOT NULL REFERENCES commerce_entitlements(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  user_entitlement_id uuid NOT NULL UNIQUE REFERENCES commerce_entitlements(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  revoked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoke_reason text NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_school_seat_revocation_shape CHECK (
    (status='revoked' AND revoked_at IS NOT NULL)
    OR (status='active' AND revoked_at IS NULL)
  )
);

CREATE UNIQUE INDEX commerce_school_seat_active_user_idx
  ON commerce_school_seat_assignments(school_entitlement_id,user_id)
  WHERE status='active';
CREATE INDEX commerce_school_seat_capacity_idx
  ON commerce_school_seat_assignments(school_entitlement_id,status,user_id);

COMMIT;
