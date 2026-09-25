BEGIN;

CREATE INDEX courses_title_trgm_idx
  ON courses USING gin (title gin_trgm_ops);

CREATE INDEX lessons_title_trgm_idx
  ON lessons USING gin (title gin_trgm_ops);

CREATE INDEX library_items_title_trgm_idx
  ON library_items USING gin (title gin_trgm_ops);

CREATE INDEX foundation_topics_title_trgm_idx
  ON foundation_topics USING gin (title gin_trgm_ops);

CREATE INDEX course_modules_title_trgm_idx
  ON course_modules USING gin (title gin_trgm_ops);

COMMIT;
