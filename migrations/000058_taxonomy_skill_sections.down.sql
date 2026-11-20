-- Do not silently erase explicitly imported taxonomy or relationships.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM taxonomy_skill_sections) OR EXISTS (SELECT 1 FROM skills WHERE section_id IS NOT NULL) OR EXISTS (SELECT 1 FROM questions WHERE section_id IS NOT NULL) THEN
    RAISE EXCEPTION 'taxonomy skill sections contain data; export and explicitly remove it before rollback';
  END IF;
END $$;
ALTER TABLE questions DROP CONSTRAINT questions_section_subject_fk, DROP CONSTRAINT questions_section_subject_required, DROP COLUMN section_id;
ALTER TABLE skills DROP CONSTRAINT skills_section_subject_fk, DROP CONSTRAINT skills_section_main_only, DROP COLUMN section_id;
DROP TABLE taxonomy_skill_sections;
