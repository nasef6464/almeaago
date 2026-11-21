BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM lesson_discussion_messages) THEN
    RAISE EXCEPTION 'cannot remove lesson discussions while messages exist';
  END IF;
END $$;
DROP TABLE lesson_discussion_messages;
COMMIT;
