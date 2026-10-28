BEGIN;
CREATE TABLE content_homepage_settings (
 key text PRIMARY KEY CHECK (key = 'default'),
 settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
  jsonb_typeof(settings) = 'object' AND
  NOT (settings ?| ARRAY['featuredPathIds','featuredCourseIds','featuredArticleLessonIds'])
 ),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE content_homepage_featured_paths (
 settings_key text NOT NULL REFERENCES content_homepage_settings(key) ON DELETE CASCADE,
 position integer NOT NULL CHECK (position >= 0),
 path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
 PRIMARY KEY (settings_key,position)
);
CREATE INDEX content_homepage_featured_paths_reference_idx ON content_homepage_featured_paths(path_id);
CREATE TABLE content_homepage_featured_courses (
 settings_key text NOT NULL REFERENCES content_homepage_settings(key) ON DELETE CASCADE,
 position integer NOT NULL CHECK (position >= 0),
 course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
 PRIMARY KEY (settings_key,position)
);
CREATE INDEX content_homepage_featured_courses_reference_idx ON content_homepage_featured_courses(course_id);
CREATE TABLE content_homepage_featured_lessons (
 settings_key text NOT NULL REFERENCES content_homepage_settings(key) ON DELETE CASCADE,
 position integer NOT NULL CHECK (position >= 0),
 lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 PRIMARY KEY (settings_key,position)
);
CREATE INDEX content_homepage_featured_lessons_reference_idx ON content_homepage_featured_lessons(lesson_id);
COMMIT;
