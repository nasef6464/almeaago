BEGIN;

CREATE TABLE study_plans (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (btrim(name) <> ''),
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date NOT NULL,
  skip_completed_assessments boolean NOT NULL DEFAULT true,
  daily_minutes integer NOT NULL DEFAULT 90 CHECK (daily_minutes BETWEEN 15 AND 240),
  preferred_start_time time NOT NULL DEFAULT TIME '17:00',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_plans_date_order CHECK (end_date >= start_date),
  CONSTRAINT study_plans_date_span CHECK (end_date <= start_date + 180)
);

CREATE INDEX study_plans_student_path_status_idx
  ON study_plans(student_id,path_id,status,updated_at DESC,id DESC);

CREATE TABLE study_plan_subjects (
  plan_id uuid NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  PRIMARY KEY(plan_id,subject_id)
);

CREATE INDEX study_plan_subjects_subject_idx
  ON study_plan_subjects(subject_id,plan_id);

CREATE TABLE study_plan_courses (
  plan_id uuid NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  PRIMARY KEY(plan_id,course_id)
);

CREATE INDEX study_plan_courses_course_idx
  ON study_plan_courses(course_id,plan_id);

CREATE TABLE study_plan_off_days (
  plan_id uuid NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  weekday text NOT NULL CHECK (weekday IN ('saturday','sunday','monday','tuesday','wednesday','thursday','friday')),
  PRIMARY KEY(plan_id,weekday)
);

CREATE TABLE study_plan_items (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  plan_id uuid NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT,
  item_type text NOT NULL CHECK (item_type IN ('lesson','assessment','resource')),
  lesson_id uuid REFERENCES lessons(id) ON DELETE RESTRICT,
  course_id uuid REFERENCES courses(id) ON DELETE RESTRICT,
  library_item_id uuid REFERENCES library_items(id) ON DELETE RESTRICT,
  assessment_placement_id uuid REFERENCES assessment_learning_placements(id) ON DELETE RESTRICT,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 10 AND 240),
  phase text NOT NULL CHECK (phase IN ('foundation','practice','review')),
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_plan_items_target_shape CHECK (
    (item_type='lesson' AND lesson_id IS NOT NULL AND course_id IS NOT NULL AND library_item_id IS NULL AND assessment_placement_id IS NULL)
    OR
    (item_type='resource' AND lesson_id IS NULL AND course_id IS NULL AND library_item_id IS NOT NULL AND assessment_placement_id IS NULL)
    OR
    (item_type='assessment' AND lesson_id IS NULL AND library_item_id IS NULL AND assessment_placement_id IS NOT NULL)
  )
);

CREATE INDEX study_plan_items_schedule_idx
  ON study_plan_items(plan_id,scheduled_date,scheduled_time,sort_order,id);

CREATE INDEX study_plan_items_lesson_idx
  ON study_plan_items(lesson_id,course_id)
  WHERE lesson_id IS NOT NULL;

CREATE INDEX study_plan_items_assessment_idx
  ON study_plan_items(assessment_placement_id)
  WHERE assessment_placement_id IS NOT NULL;

COMMIT;
