BEGIN;

DROP TABLE IF EXISTS commerce_revenue_entries;

ALTER TABLE commerce_payment_requests
  DROP CONSTRAINT IF EXISTS commerce_payment_revenue_snapshot_shape,
  DROP COLUMN IF EXISTS revenue_share_percentage,
  DROP COLUMN IF EXISTS revenue_trainer_user_id,
  DROP COLUMN IF EXISTS revenue_course_id;

COMMIT;
