BEGIN;

DROP INDEX IF EXISTS teaching_assignments_school_status_teacher_idx;
DROP INDEX IF EXISTS class_memberships_user_active_joined_idx;
DROP INDEX IF EXISTS school_memberships_school_role_status_user_idx;

COMMIT;
