BEGIN;

ALTER TABLE assessment_versions
  ADD COLUMN access_type text NOT NULL DEFAULT 'free'
    CHECK (access_type IN ('free','paid','private','course_only'));

ALTER TABLE assessment_learning_placements
  ADD COLUMN access_type text NOT NULL DEFAULT 'inherit'
    CHECK (access_type IN ('inherit','free','paid','package'));

COMMIT;
