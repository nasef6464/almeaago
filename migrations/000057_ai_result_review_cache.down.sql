BEGIN;
DELETE FROM ai_question_assist_cache WHERE review_card_id IS NULL;
ALTER TABLE ai_question_assist_cache ALTER COLUMN review_card_id SET NOT NULL;
COMMIT;
