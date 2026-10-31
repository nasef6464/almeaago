BEGIN;

-- Levels were introduced after the original paths/subjects presentation columns.
-- Taxonomy now persists the same bounded display metadata (icon/iconUrl) for
-- levels, so the schema must expose the JSONB presentation field as well.
ALTER TABLE levels
  ADD COLUMN presentation jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
