ALTER TABLE commerce_payment_requests
  ADD COLUMN IF NOT EXISTS parent_approval_status text NOT NULL DEFAULT 'pending'
    CHECK (parent_approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS parent_approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_approved_at timestamptz;

CREATE INDEX IF NOT EXISTS commerce_payment_requests_parent_pending_idx
  ON commerce_payment_requests(user_id, created_at DESC, id DESC)
  WHERE status = 'pending' AND parent_approval_status = 'pending';
