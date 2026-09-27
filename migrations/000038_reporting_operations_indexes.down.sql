BEGIN;

DROP INDEX IF EXISTS mastery_evidence_scope_recent_idx;
DROP INDEX IF EXISTS assessment_results_recent_student_idx;
DROP INDEX IF EXISTS audit_logs_action_status_created_idx;
DROP INDEX IF EXISTS audit_logs_status_created_idx;

COMMIT;
