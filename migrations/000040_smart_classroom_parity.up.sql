BEGIN;

ALTER TABLE classroom_participants
  ALTER COLUMN joined_at DROP NOT NULL,
  ADD COLUMN joined_method text
    CHECK (joined_method IS NULL OR joined_method IN ('pin','qr','dashboard_cta'));

ALTER TABLE classroom_batches
  ADD COLUMN competition_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN challenge_duration_seconds integer
    CHECK (challenge_duration_seconds IS NULL OR challenge_duration_seconds BETWEEN 10 AND 600),
  ADD COLUMN timer_started_at timestamptz,
  ADD COLUMN timer_ends_at timestamptz,
  ADD CONSTRAINT classroom_batches_timer_shape_chk CHECK (
    (competition_enabled=false)
    OR (
      challenge_duration_seconds IS NOT NULL
      AND timer_started_at IS NOT NULL
      AND timer_ends_at IS NOT NULL
      AND timer_ends_at >= timer_started_at
    )
  );

CREATE INDEX classroom_batches_active_competition_idx
  ON classroom_batches(session_id,timer_ends_at,id)
  WHERE competition_enabled=true AND ended_at IS NULL;

COMMIT;
