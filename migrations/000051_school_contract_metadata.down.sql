BEGIN;

ALTER TABLE school_contracts
  DROP COLUMN IF EXISTS metadata;

COMMIT;

