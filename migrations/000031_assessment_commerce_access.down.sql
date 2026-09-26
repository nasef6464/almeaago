BEGIN;

ALTER TABLE assessment_learning_placements
  DROP COLUMN IF EXISTS access_type;

ALTER TABLE assessment_versions
  DROP COLUMN IF EXISTS access_type;

COMMIT;
