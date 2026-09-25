BEGIN;

DROP INDEX IF EXISTS assets_pending_expiry_idx;
DROP INDEX IF EXISTS assets_sha256_live_unique_idx;

UPDATE assets
SET status = 'orphan_candidate'
WHERE status = 'pending_upload';

ALTER TABLE assets
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS upload_expires_at;

ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_status_check;

ALTER TABLE assets
  ADD CONSTRAINT assets_status_check
  CHECK (status IN ('active','orphan_candidate','archived'));

COMMIT;
