BEGIN;
ALTER TABLE ai_question_assist_cache ALTER COLUMN review_card_id DROP NOT NULL;
COMMIT;
