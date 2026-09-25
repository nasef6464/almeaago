BEGIN;

ALTER TABLE question_import_batches
  DROP CONSTRAINT IF EXISTS question_import_batches_status_check;

ALTER TABLE question_import_batches
  ALTER COLUMN status SET DEFAULT 'preflight',
  ADD COLUMN manifest_hash text,
  ADD COLUMN preflight_expires_at timestamptz,
  ADD COLUMN committed_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT question_import_batches_status_check
    CHECK (status IN ('preflight','imported','rolled_back')),
  ADD CONSTRAINT question_import_batches_manifest_hash_check
    CHECK (manifest_hash IS NULL OR manifest_hash ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT question_import_batches_preflight_shape_check
    CHECK (
      status <> 'preflight'
      OR (
        manifest_hash IS NOT NULL
        AND preflight_expires_at IS NOT NULL
        AND inserted_count = 0
      )
    ),
  ADD CONSTRAINT question_import_batches_import_shape_check
    CHECK (
      status <> 'imported'
      OR inserted_count BETWEEN 1 AND requested_count
    );

CREATE INDEX question_import_batches_status_expiry_idx
  ON question_import_batches(status, preflight_expires_at, created_at DESC, id DESC);

COMMIT;
