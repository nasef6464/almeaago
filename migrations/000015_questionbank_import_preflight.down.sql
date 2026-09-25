BEGIN;

DROP INDEX IF EXISTS question_import_batches_status_expiry_idx;

ALTER TABLE question_import_batches
  DROP CONSTRAINT IF EXISTS question_import_batches_import_shape_check,
  DROP CONSTRAINT IF EXISTS question_import_batches_preflight_shape_check,
  DROP CONSTRAINT IF EXISTS question_import_batches_manifest_hash_check,
  DROP CONSTRAINT IF EXISTS question_import_batches_status_check;

UPDATE question_import_batches
SET status='rolled_back'
WHERE status='preflight';

ALTER TABLE question_import_batches
  ALTER COLUMN status SET DEFAULT 'imported',
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS committed_at,
  DROP COLUMN IF EXISTS preflight_expires_at,
  DROP COLUMN IF EXISTS manifest_hash,
  ADD CONSTRAINT question_import_batches_status_check
    CHECK (status IN ('imported','rolled_back'));

COMMIT;
