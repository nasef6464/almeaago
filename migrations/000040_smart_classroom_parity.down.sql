BEGIN;

DROP INDEX IF EXISTS classroom_batches_active_competition_idx;
ALTER TABLE classroom_batches
  DROP CONSTRAINT IF EXISTS classroom_batches_timer_shape_chk,
  DROP COLUMN IF EXISTS timer_ends_at,
  DROP COLUMN IF EXISTS timer_started_at,
  DROP COLUMN IF EXISTS challenge_duration_seconds,
  DROP COLUMN IF EXISTS competition_enabled;

UPDATE classroom_participants
SET joined_at=COALESCE(joined_at,attendance_overridden_at,now())
WHERE joined_at IS NULL;

ALTER TABLE classroom_participants
  DROP COLUMN IF EXISTS joined_method,
  ALTER COLUMN joined_at SET NOT NULL;

COMMIT;
