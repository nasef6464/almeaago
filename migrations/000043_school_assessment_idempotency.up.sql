BEGIN;

-- Retries for director publishing are durable across HTTP workers/restarts.
-- Every reservation and its resulting assessment commit in one transaction.
CREATE TABLE school_assessment_create_requests (
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  request_key uuid NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  assessment_id uuid REFERENCES assessments(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id,request_key)
);

CREATE UNIQUE INDEX school_assessment_create_requests_assessment_idx
  ON school_assessment_create_requests(assessment_id)
  WHERE assessment_id IS NOT NULL;

COMMIT;
