BEGIN;

CREATE TABLE IF NOT EXISTS school_inquiries (
    id                    uuid PRIMARY KEY DEFAULT uuidv7(),
    ref_number            varchar(32) NOT NULL,
    school_name           varchar(255) NOT NULL,
    city                  varchar(100) NOT NULL DEFAULT '',
    director_name         varchar(255) NOT NULL,
    phone                 varchar(50) NOT NULL,
    email                 varchar(255) NOT NULL DEFAULT '',
    student_count         integer NOT NULL DEFAULT 0 CHECK (student_count >= 0),
    tier_id               varchar(50) NOT NULL DEFAULT '',
    tier_name             varchar(100) NOT NULL DEFAULT '',
    paths                 jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(paths) = 'array'),
    notes                 text NOT NULL DEFAULT '',
    total_annual_estimate numeric(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_annual_estimate >= 0),
    created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS school_inquiries_ref_number_key ON school_inquiries(ref_number);
CREATE INDEX IF NOT EXISTS school_inquiries_created_at_idx ON school_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS school_inquiries_city_idx ON school_inquiries(city);
CREATE INDEX IF NOT EXISTS school_inquiries_tier_idx ON school_inquiries(tier_id);

COMMIT;
