BEGIN;

CREATE INDEX IF NOT EXISTS courses_thumbnail_asset_idx
  ON courses(thumbnail_asset_id)
  WHERE thumbnail_asset_id IS NOT NULL;

COMMIT;
