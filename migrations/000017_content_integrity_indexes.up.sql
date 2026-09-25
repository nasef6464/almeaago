BEGIN;

CREATE UNIQUE INDEX subjects_id_path_unique_idx
  ON subjects(id, path_id);

ALTER TABLE courses
  ADD CONSTRAINT courses_subject_path_fk
    FOREIGN KEY (subject_id, path_id)
    REFERENCES subjects(id, path_id)
    ON DELETE RESTRICT;

ALTER TABLE lessons
  ADD CONSTRAINT lessons_subject_path_fk
    FOREIGN KEY (subject_id, path_id)
    REFERENCES subjects(id, path_id)
    ON DELETE RESTRICT;

ALTER TABLE library_items
  ADD CONSTRAINT library_items_subject_path_fk
    FOREIGN KEY (subject_id, path_id)
    REFERENCES subjects(id, path_id)
    ON DELETE RESTRICT;

ALTER TABLE foundation_topics
  ADD CONSTRAINT foundation_topics_subject_path_fk
    FOREIGN KEY (subject_id, path_id)
    REFERENCES subjects(id, path_id)
    ON DELETE RESTRICT;

CREATE INDEX courses_title_trgm_idx
  ON courses USING gin (lower(title) gin_trgm_ops);

CREATE INDEX lessons_title_trgm_idx
  ON lessons USING gin (lower(title) gin_trgm_ops);

CREATE INDEX library_items_title_trgm_idx
  ON library_items USING gin (lower(title) gin_trgm_ops);

CREATE INDEX foundation_topics_title_trgm_idx
  ON foundation_topics USING gin (lower(title) gin_trgm_ops);

CREATE INDEX foundation_topics_code_trgm_idx
  ON foundation_topics USING gin (lower(code) gin_trgm_ops);

COMMIT;
