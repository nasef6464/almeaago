BEGIN;

DROP INDEX IF EXISTS teaching_assignments_scope_unique_idx;
ALTER TABLE teaching_assignments
  ALTER COLUMN subject_id SET NOT NULL;

DROP INDEX IF EXISTS school_memberships_user_role_status_idx;
DROP INDEX IF EXISTS parent_student_student_status_idx;
DROP INDEX IF EXISTS parent_student_parent_status_idx;
DROP INDEX IF EXISTS teaching_assignments_teacher_active_idx;
DROP INDEX IF EXISTS class_memberships_class_status_user_idx;
DROP INDEX IF EXISTS classes_school_status_created_idx;
DROP INDEX IF EXISTS classes_name_trgm_idx;
DROP INDEX IF EXISTS schools_name_trgm_idx;
DROP INDEX IF EXISTS school_supervisor_scopes_user_active_idx;
DROP INDEX IF EXISTS school_supervisor_scope_class_active_unique;
DROP INDEX IF EXISTS school_supervisor_scope_school_active_unique;
DROP TABLE IF EXISTS school_supervisor_scopes;
DROP INDEX IF EXISTS school_membership_permissions_permission_idx;
DROP TABLE IF EXISTS school_membership_permissions;
ALTER TABLE class_memberships DROP CONSTRAINT IF EXISTS class_memberships_status_check;
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_status_check;
ALTER TABLE classes DROP COLUMN IF EXISTS metadata;
ALTER TABLE schools DROP COLUMN IF EXISTS metadata;

COMMIT;
