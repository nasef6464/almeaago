BEGIN;

CREATE TABLE school_interventions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  action_type text NOT NULL DEFAULT 'study_plan' CHECK (action_type='study_plan'),
  study_plan_id uuid NOT NULL REFERENCES study_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  assigned_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  follow_up_at timestamptz,
  remediation_threshold numeric(6,3) CHECK (remediation_threshold BETWEEN 0 AND 100),
  minimum_evidence integer NOT NULL DEFAULT 3 CHECK (minimum_evidence BETWEEN 1 AND 100),
  baseline_evidence_count integer NOT NULL DEFAULT 0 CHECK (baseline_evidence_count >= 0),
  baseline_correct integer NOT NULL DEFAULT 0 CHECK (baseline_correct >= 0),
  baseline_accuracy numeric(6,3) CHECK (baseline_accuracy BETWEEN 0 AND 100),
  outcome_evidence_count integer,
  outcome_correct integer,
  outcome_accuracy numeric(6,3),
  outcome_measured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (baseline_correct <= baseline_evidence_count),
  CHECK (
    (outcome_evidence_count IS NULL AND outcome_correct IS NULL AND outcome_accuracy IS NULL AND outcome_measured_at IS NULL)
    OR
    (
      outcome_evidence_count IS NOT NULL
      AND outcome_evidence_count >= 0
      AND outcome_correct IS NOT NULL
      AND outcome_correct >= 0
      AND outcome_correct <= outcome_evidence_count
      AND (outcome_accuracy IS NULL OR outcome_accuracy BETWEEN 0 AND 100)
      AND outcome_measured_at IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX school_interventions_active_student_skill_unique
  ON school_interventions(school_id,class_id,student_id,skill_id)
  WHERE status='active';

CREATE INDEX school_interventions_school_class_status_idx
  ON school_interventions(school_id,class_id,status,created_at DESC,id DESC);

CREATE INDEX school_interventions_student_status_idx
  ON school_interventions(student_id,status,updated_at DESC,id DESC);

CREATE INDEX school_interventions_plan_idx
  ON school_interventions(study_plan_id);

COMMIT;
