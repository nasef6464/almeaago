BEGIN;

CREATE INDEX audit_logs_created_idx
  ON audit_logs(created_at DESC,id DESC);

CREATE INDEX audit_logs_status_created_idx
  ON audit_logs(status,created_at DESC,id DESC);

CREATE INDEX audit_logs_action_status_created_idx
  ON audit_logs(action,status,created_at DESC,id DESC);

CREATE INDEX assessment_results_recent_student_idx
  ON assessment_results(finalized_at DESC,student_id,attempt_id);

CREATE INDEX mastery_evidence_scope_recent_idx
  ON mastery_evidence(path_id,subject_id,occurred_at DESC,student_id,id);

COMMIT;
