BEGIN;

ALTER TABLE levels
  ADD COLUMN IF NOT EXISTS presentation jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
