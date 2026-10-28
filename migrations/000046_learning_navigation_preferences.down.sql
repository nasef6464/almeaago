BEGIN;
DROP TABLE learning_navigation_stages;
DROP TABLE learning_navigation_paths;
ALTER TABLE levels DROP CONSTRAINT levels_id_path_navigation_unique;
COMMIT;
