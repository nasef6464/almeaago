BEGIN;

ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_status_check;

ALTER TABLE assets
  ADD CONSTRAINT assets_status_check
  CHECK (status IN ('pending_upload','active','orphan_candidate','archived'));

ALTER TABLE assets
  ADD COLUMN upload_expires_at timestamptz,
  ADD COLUMN verified_at timestamptz;

CREATE UNIQUE INDEX assets_sha256_live_unique_idx
  ON assets(sha256)
  WHERE sha256 IS NOT NULL
    AND status IN ('pending_upload','active');

CREATE INDEX assets_pending_expiry_idx
  ON assets(upload_expires_at, id)
  WHERE status = 'pending_upload';

COMMIT;
