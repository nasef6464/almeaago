BEGIN;

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL DEFAULT '',
  instructor_name text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  level text NOT NULL DEFAULT 'beginner'
    CHECK (level IN ('beginner','intermediate','advanced')),
  owner_type text NOT NULL DEFAULT 'platform'
    CHECK (owner_type IN ('platform','teacher','school')),
  owner_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  owner_school_id uuid REFERENCES schools(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  workflow_status text NOT NULL DEFAULT 'draft'
    CHECK (workflow_status IN ('draft','pending_review','approved','rejected','archived')),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  reviewer_notes text NOT NULL DEFAULT '',
  revenue_share_percentage numeric(5,2)
    CHECK (revenue_share_percentage IS NULL OR (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100)),
  is_visible boolean NOT NULL DEFAULT true,
  drip_content_enabled boolean NOT NULL DEFAULT false,
  certificate_enabled boolean NOT NULL DEFAULT false,
  thumbnail_asset_id uuid REFERENCES assets(id) ON DELETE RESTRICT,
  presentation jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_owner_shape CHECK (
    (owner_type='platform' AND owner_user_id IS NULL AND owner_school_id IS NULL)
    OR (owner_type='teacher' AND owner_user_id IS NOT NULL AND owner_school_id IS NULL)
    OR (owner_type='school' AND owner_user_id IS NULL AND owner_school_id IS NOT NULL)
  )
);

CREATE INDEX courses_taxonomy_workflow_idx
  ON courses(path_id, subject_id, workflow_status, is_visible, updated_at DESC, id DESC);
CREATE INDEX courses_owner_user_idx
  ON courses(owner_user_id, workflow_status, updated_at DESC, id DESC)
  WHERE owner_user_id IS NOT NULL;
CREATE INDEX courses_owner_school_idx
  ON courses(owner_school_id, workflow_status, updated_at DESC, id DESC)
  WHERE owner_school_id IS NOT NULL;
CREATE INDEX courses_assigned_teacher_idx
  ON courses(assigned_teacher_id, workflow_status, updated_at DESC, id DESC)
  WHERE assigned_teacher_id IS NOT NULL;

CREATE TABLE course_modules (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX course_modules_course_order_idx
  ON course_modules(course_id, status, sort_order, id);

CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL DEFAULT '',
  lesson_type text NOT NULL
    CHECK (lesson_type IN ('video','file','text','assignment','live_youtube','zoom','google_meet','teams')),
  content_text text NOT NULL DEFAULT '',
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  video_url text,
  video_source text
    CHECK (video_source IS NULL OR video_source IN ('upload','youtube','vimeo')),
  meeting_url text,
  meeting_at timestamptz,
  recording_url text,
  join_instructions text NOT NULL DEFAULT '',
  show_recording boolean NOT NULL DEFAULT false,
  owner_type text NOT NULL DEFAULT 'platform'
    CHECK (owner_type IN ('platform','teacher','school')),
  owner_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  owner_school_id uuid REFERENCES schools(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  workflow_status text NOT NULL DEFAULT 'draft'
    CHECK (workflow_status IN ('draft','pending_review','approved','rejected','archived')),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  reviewer_notes text NOT NULL DEFAULT '',
  revenue_share_percentage numeric(5,2)
    CHECK (revenue_share_percentage IS NULL OR (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100)),
  is_visible boolean NOT NULL DEFAULT true,
  is_locked boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lessons_owner_shape CHECK (
    (owner_type='platform' AND owner_user_id IS NULL AND owner_school_id IS NULL)
    OR (owner_type='teacher' AND owner_user_id IS NOT NULL AND owner_school_id IS NULL)
    OR (owner_type='school' AND owner_user_id IS NULL AND owner_school_id IS NOT NULL)
  )
);

CREATE INDEX lessons_taxonomy_workflow_idx
  ON lessons(path_id, subject_id, workflow_status, is_visible, updated_at DESC, id DESC);
CREATE INDEX lessons_owner_user_idx
  ON lessons(owner_user_id, workflow_status, updated_at DESC, id DESC)
  WHERE owner_user_id IS NOT NULL;
CREATE INDEX lessons_owner_school_idx
  ON lessons(owner_school_id, workflow_status, updated_at DESC, id DESC)
  WHERE owner_school_id IS NOT NULL;
CREATE INDEX lessons_assigned_teacher_idx
  ON lessons(assigned_teacher_id, workflow_status, updated_at DESC, id DESC)
  WHERE assigned_teacher_id IS NOT NULL;

CREATE TABLE course_lessons (
  module_id uuid NOT NULL REFERENCES course_modules(id) ON DELETE RESTRICT,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_preview boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(module_id, lesson_id)
);

CREATE INDEX course_lessons_module_order_idx
  ON course_lessons(module_id, sort_order, lesson_id);
CREATE INDEX course_lessons_lesson_idx
  ON course_lessons(lesson_id, module_id);

CREATE TABLE course_skill_links (
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  relation_type text NOT NULL DEFAULT 'target'
    CHECK (relation_type IN ('target','prerequisite','secondary')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(course_id, skill_id)
);

CREATE INDEX course_skill_links_skill_idx
  ON course_skill_links(skill_id, course_id);

CREATE TABLE course_assets (
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  purpose text NOT NULL
    CHECK (purpose IN ('thumbnail','attachment','supporting_file')),
  title text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(course_id, asset_id, purpose)
);

CREATE TABLE lesson_skill_links (
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  relation_type text NOT NULL DEFAULT 'target'
    CHECK (relation_type IN ('target','prerequisite','secondary')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(lesson_id, skill_id)
);

CREATE INDEX lesson_skill_links_skill_idx
  ON lesson_skill_links(skill_id, lesson_id);

CREATE TABLE lesson_assets (
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  purpose text NOT NULL
    CHECK (purpose IN ('video','file','recording','attachment')),
  title text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(lesson_id, asset_id, purpose)
);

ALTER TABLE foundation_topics
  RENAME COLUMN name TO title;

ALTER TABLE foundation_topics
  DROP CONSTRAINT IF EXISTS foundation_topics_subject_id_fkey;

ALTER TABLE foundation_topics
  ADD CONSTRAINT foundation_topics_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT,
  ADD COLUMN path_id uuid REFERENCES paths(id) ON DELETE RESTRICT,
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN is_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  ADD CONSTRAINT foundation_topics_parent_not_self
    CHECK (parent_topic_id IS NULL OR parent_topic_id <> id),
  ADD CONSTRAINT foundation_topics_status_check
    CHECK (status IN ('active','inactive','archived'));

UPDATE foundation_topics t
SET path_id = s.path_id
FROM subjects s
WHERE s.id = t.subject_id;

ALTER TABLE foundation_topics
  ALTER COLUMN path_id SET NOT NULL;

CREATE INDEX foundation_topics_scope_tree_idx
  ON foundation_topics(path_id, subject_id, status, parent_topic_id, sort_order, id);
CREATE INDEX foundation_topics_parent_idx
  ON foundation_topics(parent_topic_id, sort_order, id)
  WHERE parent_topic_id IS NOT NULL;

ALTER TABLE foundation_topic_skills
  RENAME TO topic_skill_links;

ALTER TABLE topic_skill_links
  ADD COLUMN relation_type text NOT NULL DEFAULT 'secondary'
    CHECK (relation_type IN ('primary','secondary')),
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

WITH ranked AS (
  SELECT topic_id, skill_id,
         row_number() OVER (PARTITION BY topic_id ORDER BY skill_id) AS rn
  FROM topic_skill_links
)
UPDATE topic_skill_links tsl
SET relation_type = CASE WHEN ranked.rn = 1 THEN 'primary' ELSE 'secondary' END
FROM ranked
WHERE ranked.topic_id = tsl.topic_id
  AND ranked.skill_id = tsl.skill_id;

CREATE UNIQUE INDEX topic_skill_links_one_primary_idx
  ON topic_skill_links(topic_id)
  WHERE relation_type='primary';
CREATE INDEX topic_skill_links_skill_idx
  ON topic_skill_links(skill_id, topic_id);

CREATE TABLE topic_lessons (
  topic_id uuid NOT NULL REFERENCES foundation_topics(id) ON DELETE RESTRICT,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(topic_id, lesson_id)
);

CREATE INDEX topic_lessons_topic_order_idx
  ON topic_lessons(topic_id, sort_order, lesson_id);

CREATE TABLE library_items (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL DEFAULT '',
  item_type text NOT NULL DEFAULT 'pdf'
    CHECK (item_type IN ('pdf','doc','video','link')),
  external_url text,
  owner_type text NOT NULL DEFAULT 'platform'
    CHECK (owner_type IN ('platform','teacher','school')),
  owner_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  owner_school_id uuid REFERENCES schools(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  workflow_status text NOT NULL DEFAULT 'draft'
    CHECK (workflow_status IN ('draft','pending_review','approved','rejected','archived')),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  reviewer_notes text NOT NULL DEFAULT '',
  revenue_share_percentage numeric(5,2)
    CHECK (revenue_share_percentage IS NULL OR (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100)),
  is_visible boolean NOT NULL DEFAULT true,
  is_locked boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT library_items_owner_shape CHECK (
    (owner_type='platform' AND owner_user_id IS NULL AND owner_school_id IS NULL)
    OR (owner_type='teacher' AND owner_user_id IS NOT NULL AND owner_school_id IS NULL)
    OR (owner_type='school' AND owner_user_id IS NULL AND owner_school_id IS NOT NULL)
  ),
  CONSTRAINT library_items_location_check
    CHECK (external_url IS NOT NULL OR item_type <> 'link')
);

CREATE INDEX library_items_taxonomy_workflow_idx
  ON library_items(path_id, subject_id, workflow_status, is_visible, updated_at DESC, id DESC);
CREATE INDEX library_items_owner_user_idx
  ON library_items(owner_user_id, workflow_status, updated_at DESC, id DESC)
  WHERE owner_user_id IS NOT NULL;
CREATE INDEX library_items_owner_school_idx
  ON library_items(owner_school_id, workflow_status, updated_at DESC, id DESC)
  WHERE owner_school_id IS NOT NULL;

CREATE TABLE library_skill_links (
  library_item_id uuid NOT NULL REFERENCES library_items(id) ON DELETE RESTRICT,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  relation_type text NOT NULL DEFAULT 'target'
    CHECK (relation_type IN ('target','secondary')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(library_item_id, skill_id)
);

CREATE INDEX library_skill_links_skill_idx
  ON library_skill_links(skill_id, library_item_id);

CREATE TABLE library_item_assets (
  library_item_id uuid NOT NULL REFERENCES library_items(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  purpose text NOT NULL DEFAULT 'primary'
    CHECK (purpose IN ('primary','preview','attachment')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(library_item_id, asset_id, purpose)
);

CREATE UNIQUE INDEX library_item_assets_one_primary_idx
  ON library_item_assets(library_item_id)
  WHERE purpose='primary';

CREATE TABLE topic_library_items (
  topic_id uuid NOT NULL REFERENCES foundation_topics(id) ON DELETE RESTRICT,
  library_item_id uuid NOT NULL REFERENCES library_items(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(topic_id, library_item_id)
);

CREATE INDEX topic_library_items_topic_order_idx
  ON topic_library_items(topic_id, sort_order, library_item_id);

COMMIT;
