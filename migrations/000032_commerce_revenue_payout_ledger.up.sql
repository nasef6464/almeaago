BEGIN;

ALTER TABLE commerce_payment_requests
  ADD COLUMN revenue_course_id uuid,
  ADD COLUMN revenue_trainer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN revenue_share_percentage numeric(5,2)
    CHECK (revenue_share_percentage IS NULL OR (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100));

ALTER TABLE commerce_payment_requests
  ADD CONSTRAINT commerce_payment_revenue_snapshot_shape CHECK (
    (revenue_trainer_user_id IS NULL AND revenue_share_percentage IS NULL)
    OR
    (revenue_trainer_user_id IS NOT NULL)
  );

CREATE TABLE commerce_revenue_entries (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  payment_request_id uuid NOT NULL UNIQUE REFERENCES commerce_payment_requests(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES commerce_products(id) ON DELETE RESTRICT,
  product_type text NOT NULL CHECK (product_type IN ('course','package','membership')),
  course_id uuid,
  buyer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  trainer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  revenue_share_percentage numeric(5,2)
    CHECK (revenue_share_percentage IS NULL OR (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100)),
  gross_amount_minor bigint NOT NULL CHECK (gross_amount_minor > 0),
  discount_amount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0),
  paid_amount_minor bigint NOT NULL CHECK (paid_amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider_fee_minor bigint CHECK (provider_fee_minor IS NULL OR provider_fee_minor >= 0),
  trainer_share_minor bigint CHECK (trainer_share_minor IS NULL OR trainer_share_minor >= 0),
  platform_share_minor bigint CHECK (platform_share_minor IS NULL OR platform_share_minor >= 0),
  allocation_status text NOT NULL CHECK (allocation_status IN ('not_applicable','policy_missing','pending','allocated')),
  payout_status text NOT NULL CHECK (payout_status IN ('not_applicable','pending','paid')),
  allocation_evidence text NOT NULL DEFAULT '',
  allocated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  allocated_at timestamptz,
  payout_evidence text NOT NULL DEFAULT '',
  paid_by uuid REFERENCES users(id) ON DELETE SET NULL,
  payout_paid_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_revenue_amount_shape CHECK (
    discount_amount_minor <= gross_amount_minor
    AND paid_amount_minor = gross_amount_minor - discount_amount_minor
  ),
  CONSTRAINT commerce_revenue_policy_shape CHECK (
    (trainer_user_id IS NULL AND revenue_share_percentage IS NULL AND allocation_status='not_applicable' AND payout_status='not_applicable')
    OR
    (trainer_user_id IS NOT NULL AND revenue_share_percentage IS NULL AND allocation_status='policy_missing' AND payout_status='pending')
    OR
    (trainer_user_id IS NOT NULL AND revenue_share_percentage IS NOT NULL AND allocation_status IN ('pending','allocated') AND payout_status IN ('not_applicable','pending','paid'))
  ),
  CONSTRAINT commerce_revenue_allocation_shape CHECK (
    (allocation_status <> 'allocated'
      AND provider_fee_minor IS NULL
      AND trainer_share_minor IS NULL
      AND platform_share_minor IS NULL
      AND allocated_by IS NULL
      AND allocated_at IS NULL
      AND allocation_evidence = '')
    OR
    (allocation_status = 'allocated'
      AND provider_fee_minor IS NOT NULL
      AND trainer_share_minor IS NOT NULL
      AND platform_share_minor IS NOT NULL
      AND provider_fee_minor + trainer_share_minor + platform_share_minor = paid_amount_minor
      AND allocated_by IS NOT NULL
      AND allocated_at IS NOT NULL
      AND btrim(allocation_evidence) <> '')
  ),
  CONSTRAINT commerce_revenue_payout_shape CHECK (
    (payout_status <> 'paid' AND paid_by IS NULL AND payout_paid_at IS NULL AND payout_evidence = '')
    OR
    (payout_status = 'paid'
      AND allocation_status='allocated'
      AND trainer_share_minor IS NOT NULL
      AND trainer_share_minor > 0
      AND paid_by IS NOT NULL
      AND payout_paid_at IS NOT NULL
      AND btrim(payout_evidence) <> '')
  )
);

CREATE INDEX commerce_revenue_entries_trainer_idx
  ON commerce_revenue_entries(trainer_user_id,payout_status,created_at DESC,id DESC)
  WHERE trainer_user_id IS NOT NULL;

CREATE INDEX commerce_revenue_entries_admin_idx
  ON commerce_revenue_entries(allocation_status,payout_status,created_at DESC,id DESC);

COMMIT;
