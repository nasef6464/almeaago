BEGIN;

ALTER TABLE schools
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE classes
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE classes
  ADD CONSTRAINT classes_status_check
  CHECK (status IN ('active','archived'));

ALTER TABLE class_memberships
  ADD CONSTRAINT class_memberships_status_check
  CHECK (status IN ('active','inactive','revoked'));

CREATE TABLE school_membership_permissions (
  membership_id uuid NOT NULL REFERENCES school_memberships(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN (
    'SCHOOL_OVERVIEW_VIEW',
    'SCHOOL_REPORTS_AGGREGATE_VIEW',
    'SCHOOL_STUDENTS_VIEW',
    'SCHOOL_STUDENTS_ADD',
    'SCHOOL_STUDENTS_MOVE_CLASS',
    'SCHOOL_STUDENTS_UPDATE_BASIC',
    'SCHOOL_STUDENTS_DEACTIVATE',
    'SCHOOL_CLASSES_MANAGE',
    'SCHOOL_TEACHERS_ASSIGN',
    'SCHOOL_REPORTS_DETAILED_VIEW',
    'SCHOOL_REPORTS_EXPORT',
    'SCHOOL_ASSESSMENTS_MANAGE',
    'SCHOOL_SMART_CLASSROOM_VIEW',
    'SCHOOL_INTERVENTIONS_VIEW',
    'SCHOOL_INTERVENTIONS_MANAGE',
    'SCHOOL_STUDENTS_TRANSFER_SCHOOL'
  )),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membership_id, permission)
);

CREATE INDEX school_membership_permissions_permission_idx
  ON school_membership_permissions(permission, membership_id);

CREATE TABLE school_supervisor_scopes (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  supervisor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('school','class')),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (scope_type = 'school' AND class_id IS NULL)
    OR
    (scope_type = 'class' AND class_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX school_supervisor_scope_school_active_unique
  ON school_supervisor_scopes(school_id, supervisor_user_id)
  WHERE status = 'active' AND scope_type = 'school';

CREATE UNIQUE INDEX school_supervisor_scope_class_active_unique
  ON school_supervisor_scopes(school_id, supervisor_user_id, class_id)
  WHERE status = 'active' AND scope_type = 'class';

CREATE INDEX school_supervisor_scopes_user_active_idx
  ON school_supervisor_scopes(supervisor_user_id, status, school_id, class_id);

CREATE INDEX classes_school_status_created_idx
  ON classes(school_id, status, created_at DESC, id DESC);

CREATE INDEX class_memberships_class_status_user_idx
  ON class_memberships(class_id, status, user_id);

CREATE INDEX teaching_assignments_teacher_active_idx
  ON teaching_assignments(teacher_id, status, school_id, class_id, subject_id);

CREATE INDEX parent_student_parent_status_idx
  ON parent_student_relationships(parent_user_id, status, student_user_id);

CREATE INDEX parent_student_student_status_idx
  ON parent_student_relationships(student_user_id, status, parent_user_id);

CREATE INDEX school_memberships_user_role_status_idx
  ON school_memberships(user_id, role, status, school_id);

COMMIT;
