BEGIN;

DROP TRIGGER IF EXISTS classroom_report_snapshots_immutable ON classroom_report_snapshots;
DROP FUNCTION IF EXISTS prevent_classroom_report_snapshot_mutation();

DROP TABLE IF EXISTS classroom_report_snapshots;
DROP TABLE IF EXISTS classroom_responses;
DROP TABLE IF EXISTS classroom_participants;

ALTER TABLE classroom_sessions
  DROP CONSTRAINT IF EXISTS classroom_sessions_active_question_fkey,
  DROP CONSTRAINT IF EXISTS classroom_sessions_active_batch_fkey;

DROP TABLE IF EXISTS classroom_questions;
DROP TABLE IF EXISTS classroom_batches;
DROP TABLE IF EXISTS classroom_sessions;

DROP TABLE IF EXISTS school_contract_modules;
DROP TABLE IF EXISTS school_contracts;

COMMIT;
