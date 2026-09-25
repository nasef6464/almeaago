BEGIN;

DROP INDEX IF EXISTS question_import_batches_created_idx;
DROP TABLE IF EXISTS question_import_batches;

DROP INDEX IF EXISTS questions_image_hash_idx;
DROP INDEX IF EXISTS questions_import_batch_idx;
DROP INDEX IF EXISTS questions_source_item_unique_idx;

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_source_printed_question_number_check,
  DROP CONSTRAINT IF EXISTS questions_source_printed_page_number_check,
  DROP CONSTRAINT IF EXISTS questions_source_pdf_page_index_check,
  DROP CONSTRAINT IF EXISTS questions_source_document_code_check,
  DROP CONSTRAINT IF EXISTS questions_image_hash_check,
  DROP CONSTRAINT IF EXISTS questions_import_batch_id_check,
  DROP CONSTRAINT IF EXISTS questions_source_item_id_check,
  DROP COLUMN IF EXISTS source_printed_question_number,
  DROP COLUMN IF EXISTS source_printed_page_number,
  DROP COLUMN IF EXISTS source_pdf_page_index,
  DROP COLUMN IF EXISTS source_document_code,
  DROP COLUMN IF EXISTS image_hash,
  DROP COLUMN IF EXISTS import_batch_id,
  DROP COLUMN IF EXISTS source_item_id;

COMMIT;
