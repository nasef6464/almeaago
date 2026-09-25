BEGIN;

DROP TABLE IF EXISTS topic_library_items;
DROP TABLE IF EXISTS library_item_assets;
DROP TABLE IF EXISTS library_skill_links;
DROP TABLE IF EXISTS library_items;
DROP TABLE IF EXISTS topic_lessons;

DROP INDEX IF EXISTS topic_skill_links_skill_idx;
DROP INDEX IF EXISTS topic_skill_links_one_primary_idx;

ALTER TABLE topic_skill_links
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS relation_type;

ALTER TABLE topic_skill_links
  RENAME TO foundation_topic_skills;

DROP INDEX IF EXISTS foundation_topics_parent_idx;
DROP INDEX IF EXISTS foundation_topics_scope_tree_idx;

ALTER TABLE foundation_topics
  DROP CONSTRAINT IF EXISTS foundation_topics_status_check,
  DROP CONSTRAINT IF EXISTS foundation_topics_parent_not_self,
  DROP CONSTRAINT IF EXISTS foundation_topics_subject_id_fkey;

ALTER TABLE foundation_topics
  ADD CONSTRAINT foundation_topics_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  DROP COLUMN IF EXISTS revision,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS is_locked,
  DROP COLUMN IF EXISTS is_visible,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS path_id;

ALTER TABLE foundation_topics
  RENAME COLUMN title TO name;

DROP TABLE IF EXISTS lesson_assets;
DROP TABLE IF EXISTS lesson_skill_links;
DROP TABLE IF EXISTS course_assets;
DROP TABLE IF EXISTS course_skill_links;
DROP TABLE IF EXISTS course_lessons;
DROP TABLE IF EXISTS lessons;
DROP TABLE IF EXISTS course_modules;
DROP TABLE IF EXISTS courses;

COMMIT;
