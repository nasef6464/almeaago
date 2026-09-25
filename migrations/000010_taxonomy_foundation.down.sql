BEGIN;

DROP INDEX IF EXISTS skills_subject_status_parent_sort_idx;
ALTER TABLE skills
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS description;

DROP INDEX IF EXISTS subjects_path_level_status_sort_idx;
ALTER TABLE subjects
  DROP COLUMN IF EXISTS sort_order,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS level_id;

DROP INDEX IF EXISTS levels_path_status_sort_idx;
DROP TABLE IF EXISTS levels;

DROP INDEX IF EXISTS paths_parent_status_sort_idx;
ALTER TABLE paths
  DROP CONSTRAINT IF EXISTS paths_status_check,
  DROP CONSTRAINT IF EXISTS paths_parent_not_self,
  DROP COLUMN IF EXISTS sort_order,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS parent_path_id;

COMMIT;
