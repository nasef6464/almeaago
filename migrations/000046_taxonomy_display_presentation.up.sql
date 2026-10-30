BEGIN;

-- Path and subject presentation are taxonomy-owned source display metadata.
-- Keep them separate from content records and homepage selection settings.
ALTER TABLE paths
  ADD COLUMN presentation jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE subjects
  ADD COLUMN presentation jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
