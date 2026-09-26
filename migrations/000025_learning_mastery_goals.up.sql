BEGIN;

CREATE TABLE mastery_goals (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_by_role text NOT NULL DEFAULT 'student',
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('topic','section','path')),
  target_id uuid NOT NULL,
  title text NOT NULL,
  target_mastery integer NOT NULL DEFAULT 90 CHECK (target_mastery BETWEEN 50 AND 100),
  horizon text NOT NULL DEFAULT 'short' CHECK (horizon IN ('short','long')),
  due_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','achieved','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mastery_goals_path_target_shape CHECK (target_type <> 'path' OR target_id = path_id)
);

CREATE INDEX mastery_goals_student_scope_idx
  ON mastery_goals(student_id,path_id,status,due_date,id);

CREATE INDEX mastery_goals_student_target_idx
  ON mastery_goals(student_id,target_type,target_id,status,id);

COMMIT;
