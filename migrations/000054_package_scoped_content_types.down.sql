-- Restoring the old constraint intentionally fails if restricted items exist.
ALTER TABLE commerce_package_items DROP CONSTRAINT commerce_package_items_target_shape;
ALTER TABLE commerce_package_items ADD CONSTRAINT commerce_package_items_target_shape CHECK (
  (scope_type='course' AND course_id IS NOT NULL AND path_id IS NULL AND subject_id IS NULL AND content_type IS NULL)
  OR (scope_type='path' AND course_id IS NULL AND path_id IS NOT NULL AND subject_id IS NULL AND content_type IS NULL)
  OR (scope_type='subject' AND course_id IS NULL AND path_id IS NULL AND subject_id IS NOT NULL AND content_type IS NULL)
  OR (scope_type='content_type' AND course_id IS NULL AND path_id IS NULL AND subject_id IS NULL AND content_type IS NOT NULL)
  OR (scope_type='all' AND course_id IS NULL AND path_id IS NULL AND subject_id IS NULL AND content_type IS NULL)
);
