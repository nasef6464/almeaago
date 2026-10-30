BEGIN;
-- Presentation preferences only; deliberately unrelated to entitlements.
ALTER TABLE levels ADD CONSTRAINT levels_id_path_navigation_unique UNIQUE(id,path_id);
CREATE TABLE learning_navigation_paths (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 path_id uuid NOT NULL REFERENCES paths(id) ON DELETE RESTRICT,
 position integer NOT NULL CHECK(position>=0),
 PRIMARY KEY(user_id,path_id), UNIQUE(user_id,position)
);
CREATE TABLE learning_navigation_stages (
 user_id uuid NOT NULL,
 path_id uuid NOT NULL,
 level_id uuid NOT NULL,
 position integer NOT NULL CHECK(position>=0),
 PRIMARY KEY(user_id,path_id), UNIQUE(user_id,position),
 FOREIGN KEY(user_id,path_id) REFERENCES learning_navigation_paths(user_id,path_id) ON DELETE CASCADE,
 FOREIGN KEY(level_id,path_id) REFERENCES levels(id,path_id) ON DELETE RESTRICT
);
COMMIT;
