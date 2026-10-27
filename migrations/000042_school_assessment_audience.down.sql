BEGIN;

DROP INDEX IF EXISTS assessment_assignments_school_audience_idx;
ALTER TABLE assessments DROP COLUMN is_school_central_draft;
ALTER TABLE assessment_assignments
  DROP CONSTRAINT assessment_assignments_whole_school_scope_ck,
  DROP COLUMN targets_entire_school;

COMMIT;
