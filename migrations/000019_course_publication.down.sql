BEGIN;

DROP INDEX IF EXISTS courses_published_catalog_idx;

ALTER TABLE courses
  DROP CONSTRAINT IF EXISTS courses_publication_requires_approval,
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS published_by,
  DROP COLUMN IF EXISTS is_published;

COMMIT;
