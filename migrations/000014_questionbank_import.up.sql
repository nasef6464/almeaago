BEGIN;

ALTER TABLE questions
  ADD COLUMN source_item_id text,
  ADD COLUMN import_batch_id text,
  ADD COLUMN image_hash text,
  ADD COLUMN source_document_code text,
  ADD COLUMN source_pdf_page_index integer,
  ADD COLUMN source_printed_page_number integer,
  ADD COLUMN source_printed_question_number integer,
  ADD CONSTRAINT questions_source_item_id_check
    CHECK (source_item_id IS NULL OR char_length(source_item_id) BETWEEN 3 AND 200),
  ADD CONSTRAINT questions_import_batch_id_check
    CHECK (import_batch_id IS NULL OR import_batch_id ~ '^[A-Z0-9][A-Z0-9._-]{7,159}$'),
  ADD CONSTRAINT questions_image_hash_check
    CHECK (image_hash IS NULL OR image_hash ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT questions_source_document_code_check
    CHECK (source_document_code IS NULL OR source_document_code ~ '^[A-Z0-9_-]+$'),
  ADD CONSTRAINT questions_source_pdf_page_index_check
    CHECK (source_pdf_page_index IS NULL OR source_pdf_page_index >= 1),
  ADD CONSTRAINT questions_source_printed_page_number_check
    CHECK (source_printed_page_number IS NULL OR source_printed_page_number >= 1),
  ADD CONSTRAINT questions_source_printed_question_number_check
    CHECK (source_printed_question_number IS NULL OR source_printed_question_number >= 0);

CREATE UNIQUE INDEX questions_source_item_unique_idx
  ON questions(source_item_id)
  WHERE source_item_id IS NOT NULL;

CREATE INDEX questions_import_batch_idx
  ON questions(import_batch_id, created_at, id)
  WHERE import_batch_id IS NOT NULL;

CREATE INDEX questions_image_hash_idx
  ON questions(image_hash, id)
  WHERE image_hash IS NOT NULL;

CREATE TABLE question_import_batches (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  batch_id text NOT NULL UNIQUE
    CHECK (batch_id ~ '^[A-Z0-9][A-Z0-9._-]{7,159}$'),
  status text NOT NULL DEFAULT 'imported'
    CHECK (status IN ('imported','rolled_back')),
  requested_count integer NOT NULL
    CHECK (requested_count BETWEEN 1 AND 100),
  inserted_count integer NOT NULL
    CHECK (inserted_count >= 0 AND inserted_count <= requested_count),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  rolled_back_at timestamptz
);

CREATE INDEX question_import_batches_created_idx
  ON question_import_batches(created_at DESC, id DESC);

COMMIT;
