BEGIN;

-- Current taxonomy remains on questions and question_skill_links. Archive it
-- when that question version is superseded so pinned assessments can still use it.
CREATE TABLE question_version_taxonomy (
  question_id uuid NOT NULL,
  question_version integer NOT NULL,
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  PRIMARY KEY (question_id, question_version),
  FOREIGN KEY (question_id, question_version)
    REFERENCES question_versions(question_id, version) ON DELETE CASCADE
);

CREATE TABLE question_version_taxonomy_skills (
  question_id uuid NOT NULL,
  question_version integer NOT NULL,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  PRIMARY KEY (question_id, question_version, skill_id),
  FOREIGN KEY (question_id, question_version)
    REFERENCES question_version_taxonomy(question_id, question_version) ON DELETE CASCADE
);

COMMIT;
