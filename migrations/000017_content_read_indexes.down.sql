BEGIN;

DROP INDEX IF EXISTS course_modules_title_trgm_idx;
DROP INDEX IF EXISTS foundation_topics_title_trgm_idx;
DROP INDEX IF EXISTS library_items_title_trgm_idx;
DROP INDEX IF EXISTS lessons_title_trgm_idx;
DROP INDEX IF EXISTS courses_title_trgm_idx;

COMMIT;
