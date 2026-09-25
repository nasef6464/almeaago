BEGIN;

DROP INDEX IF EXISTS question_versions_video_present_idx;
DROP INDEX IF EXISTS question_versions_explanation_trgm_idx;
DROP INDEX IF EXISTS question_versions_text_trgm_idx;
DROP INDEX IF EXISTS questions_code_trgm_idx;

COMMIT;
