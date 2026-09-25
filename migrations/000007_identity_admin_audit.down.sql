BEGIN;

DROP INDEX IF EXISTS users_email_trgm_idx;
DROP INDEX IF EXISTS users_name_trgm_idx;
DROP INDEX IF EXISTS users_status_created_idx;
DROP INDEX IF EXISTS school_memberships_user_active_idx;
DROP INDEX IF EXISTS users_created_desc_idx;
DROP TABLE IF EXISTS audit_logs;

COMMIT;
