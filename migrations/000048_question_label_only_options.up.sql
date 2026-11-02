-- Empty choice text is valid for image-embedded options. The application
-- validates image presence and option count; the persisted option index stays
-- the scoring identity and labels live separately in version source_meta.
ALTER TABLE question_options DROP CONSTRAINT question_options_content_present;
