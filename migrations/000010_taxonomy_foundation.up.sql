BEGIN;

ALTER TABLE paths
  ADD COLUMN parent_path_id uuid REFERENCES paths(id) ON DELETE RESTRICT,
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE paths
  ADD CONSTRAINT paths_parent_not_self CHECK (parent_path_id IS NULL OR parent_path_id <> id),
  ADD CONSTRAINT paths_status_check CHECK (status IN ('active', 'inactive', 'archived'));

CREATE INDEX paths_parent_status_sort_idx
  ON paths(parent_path_id, status, sort_order, id);

CREATE TABLE levels (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(path_id, code)
);

CREATE INDEX levels_path_status_sort_idx
  ON levels(path_id, status, sort_order, id);

ALTER TABLE subjects
  ADD COLUMN level_id uuid REFERENCES levels(id) ON DELETE RESTRICT,
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX subjects_path_level_status_sort_idx
  ON subjects(path_id, level_id, status, sort_order, id);

ALTER TABLE skills
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived'));

CREATE INDEX skills_subject_status_parent_sort_idx
  ON skills(subject_id, status, parent_skill_id, kind, sort_order, id);

COMMIT;
