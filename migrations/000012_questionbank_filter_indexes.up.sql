BEGIN;

CREATE INDEX questions_code_trgm_idx
  ON questions USING gin (question_code gin_trgm_ops);

CREATE INDEX question_versions_text_trgm_idx
  ON question_versions USING gin (text_content gin_trgm_ops);

CREATE INDEX question_versions_explanation_trgm_idx
  ON question_versions USING gin (explanation gin_trgm_ops)
  WHERE explanation <> '';

CREATE INDEX question_versions_video_present_idx
  ON question_versions(question_id, version)
  WHERE video_url IS NOT NULL AND btrim(video_url) <> '';

COMMIT;
