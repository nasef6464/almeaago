BEGIN;

-- A school_id scopes an assignment; it does not target all pupils.
ALTER TABLE assessment_assignments
  ADD COLUMN targets_entire_school boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT assessment_assignments_whole_school_scope_ck
    CHECK (NOT targets_entire_school OR school_id IS NOT NULL);

-- Node distinguishes an untargeted central school draft from other drafts.
ALTER TABLE assessments
  ADD COLUMN is_school_central_draft boolean NOT NULL DEFAULT false;

CREATE INDEX assessment_assignments_school_audience_idx
  ON assessment_assignments(school_id, assessment_id, status)
  WHERE targets_entire_school;

COMMIT;
