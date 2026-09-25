BEGIN;

DROP INDEX IF EXISTS foundation_topics_code_trgm_idx;
DROP INDEX IF EXISTS foundation_topics_title_trgm_idx;
DROP INDEX IF EXISTS library_items_title_trgm_idx;
DROP INDEX IF EXISTS lessons_title_trgm_idx;
DROP INDEX IF EXISTS courses_title_trgm_idx;

ALTER TABLE foundation_topics
  DROP CONSTRAINT IF EXISTS foundation_topics_subject_path_fk;

ALTER TABLE library_items
  DROP CONSTRAINT IF EXISTS library_items_subject_path_fk;

ALTER TABLE lessons
  DROP CONSTRAINT IF EXISTS lessons_subject_path_fk;

ALTER TABLE courses
  DROP CONSTRAINT IF EXISTS courses_subject_path_fk;

DROP INDEX IF EXISTS subjects_id_path_unique_idx;

COMMIT;
