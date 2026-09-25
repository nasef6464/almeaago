BEGIN;

ALTER TABLE courses
  ADD COLUMN is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN published_at timestamptz,
  ADD CONSTRAINT courses_publication_requires_approval
    CHECK (NOT is_published OR workflow_status='approved');

CREATE INDEX courses_published_catalog_idx
  ON courses(path_id, subject_id, updated_at DESC, id DESC)
  WHERE workflow_status='approved' AND is_published=true AND is_visible=true;

COMMIT;
