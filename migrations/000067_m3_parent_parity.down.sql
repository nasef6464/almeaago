DROP INDEX IF EXISTS commerce_payment_requests_parent_pending_idx;

ALTER TABLE commerce_payment_requests
  DROP COLUMN IF EXISTS parent_approved_at,
  DROP COLUMN IF EXISTS parent_approved_by,
  DROP COLUMN IF EXISTS parent_approval_status;
