BEGIN;

CREATE TABLE commerce_products (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
  product_type text NOT NULL CHECK (product_type IN ('course','package','membership')),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  access_mode text NOT NULL DEFAULT 'paid' CHECK (access_mode IN ('free','paid')),
  price_minor bigint NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  currency text NOT NULL DEFAULT 'SAR' CHECK (currency ~ '^[A-Z]{3}$'),
  course_id uuid REFERENCES courses(id) ON DELETE RESTRICT,
  is_visible boolean NOT NULL DEFAULT true,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_products_target_shape CHECK (
    (product_type='course' AND course_id IS NOT NULL)
    OR (product_type IN ('package','membership') AND course_id IS NULL)
  ),
  CONSTRAINT commerce_products_free_price_check CHECK (
    access_mode <> 'free' OR price_minor = 0
  )
);

CREATE UNIQUE INDEX commerce_products_course_unique_idx
  ON commerce_products(course_id)
  WHERE course_id IS NOT NULL;

CREATE INDEX commerce_products_catalog_idx
  ON commerce_products(product_type,status,is_visible,updated_at DESC,id DESC);

CREATE TABLE commerce_packages (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  product_id uuid NOT NULL UNIQUE REFERENCES commerce_products(id) ON DELETE RESTRICT,
  package_kind text NOT NULL CHECK (package_kind IN ('bundle','membership','school')),
  seat_capacity integer CHECK (seat_capacity IS NULL OR seat_capacity > 0),
  validity_days integer CHECK (validity_days IS NULL OR validity_days > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commerce_package_items (
  package_id uuid NOT NULL REFERENCES commerce_packages(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('course','path','subject','content_type','all')),
  course_id uuid REFERENCES courses(id) ON DELETE RESTRICT,
  path_id uuid REFERENCES paths(id) ON DELETE RESTRICT,
  subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT,
  content_type text CHECK (
    content_type IS NULL OR content_type IN ('courses','foundation','banks','tests','mock_exams','library','all')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_package_items_target_shape CHECK (
    (scope_type='course' AND course_id IS NOT NULL AND path_id IS NULL AND subject_id IS NULL AND content_type IS NULL)
    OR (scope_type='path' AND course_id IS NULL AND path_id IS NOT NULL AND subject_id IS NULL AND content_type IS NULL)
    OR (scope_type='subject' AND course_id IS NULL AND path_id IS NULL AND subject_id IS NOT NULL AND content_type IS NULL)
    OR (scope_type='content_type' AND course_id IS NULL AND path_id IS NULL AND subject_id IS NULL AND content_type IS NOT NULL)
    OR (scope_type='all' AND course_id IS NULL AND path_id IS NULL AND subject_id IS NULL AND content_type IS NULL)
  )
);

CREATE UNIQUE INDEX commerce_package_items_unique_idx
  ON commerce_package_items(
    package_id,
    scope_type,
    COALESCE(course_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(path_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(subject_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(content_type,'')
  );

CREATE INDEX commerce_package_items_course_idx
  ON commerce_package_items(course_id,package_id)
  WHERE course_id IS NOT NULL;
CREATE INDEX commerce_package_items_path_idx
  ON commerce_package_items(path_id,package_id)
  WHERE path_id IS NOT NULL;
CREATE INDEX commerce_package_items_subject_idx
  ON commerce_package_items(subject_id,package_id)
  WHERE subject_id IS NOT NULL;
CREATE INDEX commerce_package_items_content_idx
  ON commerce_package_items(content_type,package_id)
  WHERE content_type IS NOT NULL;

CREATE TABLE commerce_entitlements (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  subject_type text NOT NULL CHECK (subject_type IN ('user','school')),
  user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  school_id uuid REFERENCES schools(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES commerce_products(id) ON DELETE RESTRICT,
  source_type text NOT NULL CHECK (
    source_type IN ('admin_manual','payment_request','payment_webhook','access_code','membership','school_contract')
  ),
  source_id text NOT NULL CHECK (btrim(source_id) <> ''),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  granted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  revoke_reason text NOT NULL DEFAULT '',
  idempotency_key text NOT NULL UNIQUE CHECK (btrim(idempotency_key) <> ''),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_entitlements_subject_shape CHECK (
    (subject_type='user' AND user_id IS NOT NULL AND school_id IS NULL)
    OR (subject_type='school' AND user_id IS NULL AND school_id IS NOT NULL)
  ),
  CONSTRAINT commerce_entitlements_time_check CHECK (
    expires_at IS NULL OR expires_at > starts_at
  ),
  CONSTRAINT commerce_entitlements_revocation_shape CHECK (
    (status='revoked' AND revoked_at IS NOT NULL)
    OR (status<>'revoked' AND revoked_at IS NULL)
  )
);

CREATE UNIQUE INDEX commerce_entitlements_source_subject_unique_idx
  ON commerce_entitlements(
    source_type,
    source_id,
    subject_type,
    COALESCE(user_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(school_id,'00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX commerce_entitlements_user_active_idx
  ON commerce_entitlements(user_id,status,starts_at,expires_at,product_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX commerce_entitlements_school_active_idx
  ON commerce_entitlements(school_id,status,starts_at,expires_at,product_id)
  WHERE school_id IS NOT NULL;

CREATE INDEX commerce_entitlements_product_idx
  ON commerce_entitlements(product_id,status,created_at DESC,id DESC);

-- Preserve the current learner-course behavior during staged Commerce cutover.
-- Every existing Course receives an explicit free product policy. New/purchased
-- paid state must be configured in Commerce; Content remains price-agnostic.
INSERT INTO commerce_products(
  code,product_type,name,description,status,access_mode,price_minor,currency,
  course_id,is_visible,created_at,updated_at
)
SELECT
  'COURSE-' || replace(c.id::text,'-',''),
  'course',
  c.title,
  c.description,
  CASE
    WHEN c.workflow_status='approved' AND c.is_published=true AND c.is_visible=true THEN 'active'
    ELSE 'inactive'
  END,
  'free',
  0,
  'SAR',
  c.id,
  c.is_visible,
  c.created_at,
  c.updated_at
FROM courses c
ON CONFLICT (course_id) WHERE course_id IS NOT NULL DO NOTHING;

COMMIT;
