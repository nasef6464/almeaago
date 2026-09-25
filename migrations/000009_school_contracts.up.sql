BEGIN;

CREATE TABLE school_contracts (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  school_id uuid NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','expired')),
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    valid_from IS NULL
    OR valid_until IS NULL
    OR valid_until >= valid_from
  )
);

CREATE TABLE school_contract_modules (
  contract_id uuid NOT NULL REFERENCES school_contracts(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN (
    'SCHOOL_CORE',
    'QUESTION_BANK',
    'SCHOOL_ASSESSMENTS',
    'PATHS_AND_COURSES',
    'INTERACTIVE_VIDEO',
    'SMART_CLASSROOM',
    'SCHOOL_INTELLIGENCE',
    'INTERVENTION_CENTER',
    'LIVE_TUTORING',
    'WHITE_LABEL',
    'EXECUTIVE_ANALYTICS'
  )),
  enabled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contract_id, module)
);

CREATE INDEX school_contracts_status_valid_until_idx
  ON school_contracts(status, valid_until, school_id);

CREATE INDEX school_contract_modules_module_contract_idx
  ON school_contract_modules(module, contract_id);

COMMIT;
