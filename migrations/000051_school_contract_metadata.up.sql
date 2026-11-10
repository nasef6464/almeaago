BEGIN;

ALTER TABLE school_contracts
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;

