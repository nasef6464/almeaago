BEGIN;

-- Legacy groups include SCHOOL, CLASS and PRIVATE_GROUP. They are kept as
-- platform audience groups until explicit, reviewed identity mapping exists;
-- they must not silently become a new school's membership.
CREATE TABLE prepared_quiz_groups (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  legacy_id text UNIQUE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  group_type text NOT NULL CHECK (group_type IN ('SCHOOL','CLASS','PRIVATE_GROUP')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE prepared_quiz_group_members (
  group_id uuid NOT NULL REFERENCES prepared_quiz_groups(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX prepared_quiz_group_members_user_idx ON prepared_quiz_group_members(user_id, group_id);

-- Staging only. Enabling is deliberately impossible until all assessment
-- start routes enforce the same audience policy transactionally. This avoids
-- publishing restricted metadata while an alternate start route can bypass it.
CREATE TABLE prepared_quiz_distributions (
  assessment_id uuid PRIMARY KEY REFERENCES assessments(id) ON DELETE RESTRICT,
  mode text NOT NULL CHECK (mode IN ('saher','central')),
  audience_type text NOT NULL CHECK (audience_type IN ('public','targeted')),
  due_exclusive timestamptz,
  enabled boolean NOT NULL DEFAULT false CHECK (enabled = false),
  was_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE prepared_quiz_target_users (
  assessment_id uuid NOT NULL REFERENCES prepared_quiz_distributions(assessment_id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (assessment_id, user_id)
);
CREATE TABLE prepared_quiz_target_groups (
  assessment_id uuid NOT NULL REFERENCES prepared_quiz_distributions(assessment_id) ON DELETE RESTRICT,
  group_id uuid NOT NULL REFERENCES prepared_quiz_groups(id) ON DELETE RESTRICT,
  PRIMARY KEY (assessment_id, group_id)
);

COMMIT;
