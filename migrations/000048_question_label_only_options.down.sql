-- A downgrade cannot safely invent option text for label-only questions.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM question_options WHERE option_text = '' AND asset_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot restore option text constraint while label-only options exist';
  END IF;
END $$;
ALTER TABLE question_options ADD CONSTRAINT question_options_content_present CHECK (option_text <> '' OR asset_id IS NOT NULL);
