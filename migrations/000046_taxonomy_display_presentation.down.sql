BEGIN;

ALTER TABLE subjects DROP COLUMN presentation;
ALTER TABLE paths DROP COLUMN presentation;

COMMIT;
