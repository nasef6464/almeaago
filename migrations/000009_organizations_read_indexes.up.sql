BEGIN;

CREATE INDEX school_memberships_school_role_status_user_idx
  ON school_memberships(school_id, role, status, user_id);

CREATE INDEX class_memberships_user_active_joined_idx
  ON class_memberships(user_id, joined_at DESC, class_id)
  WHERE status = 'active';

CREATE INDEX teaching_assignments_school_status_teacher_idx
  ON teaching_assignments(school_id, status, teacher_id, class_id, subject_id);

COMMIT;
