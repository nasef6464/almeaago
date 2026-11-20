-- Subject taxonomy sections are independent of assessment/mock sections.
-- Existing data stays unassigned until an explicit, verified legacy import.
CREATE TABLE taxonomy_skill_sections (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  legacy_id text UNIQUE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,subject_id)
);
CREATE INDEX taxonomy_skill_sections_subject_order_idx ON taxonomy_skill_sections(subject_id,status,sort_order,id);

ALTER TABLE skills ADD COLUMN section_id uuid;
ALTER TABLE skills ADD CONSTRAINT skills_section_subject_fk FOREIGN KEY (section_id,subject_id)
  REFERENCES taxonomy_skill_sections(id,subject_id) ON DELETE RESTRICT;
-- Embedded legacy subskills inherit their parent main skill's section.
ALTER TABLE skills ADD CONSTRAINT skills_section_main_only CHECK (section_id IS NULL OR kind='main');
CREATE INDEX skills_section_idx ON skills(section_id) WHERE section_id IS NOT NULL;

ALTER TABLE questions ADD COLUMN section_id uuid;
ALTER TABLE questions ADD CONSTRAINT questions_section_subject_required CHECK (section_id IS NULL OR subject_id IS NOT NULL);
ALTER TABLE questions ADD CONSTRAINT questions_section_subject_fk FOREIGN KEY (section_id,subject_id)
  REFERENCES taxonomy_skill_sections(id,subject_id) ON DELETE RESTRICT;
CREATE INDEX questions_section_idx ON questions(section_id) WHERE section_id IS NOT NULL;
