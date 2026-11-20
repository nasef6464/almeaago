BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM prepared_quiz_distributions WHERE enabled OR was_enabled) THEN
  RAISE EXCEPTION 'cannot remove start guards after a prepared distribution was enabled';
 END IF;
END $$;
DROP TRIGGER prepared_quiz_guard_public_start ON assessment_public_attempts;
DROP FUNCTION prepared_quiz_guard_public_start();
DROP TRIGGER prepared_quiz_guard_target_users ON prepared_quiz_target_users;
DROP TRIGGER prepared_quiz_guard_target_groups ON prepared_quiz_target_groups;
DROP FUNCTION prepared_quiz_guard_target_change();
DROP TRIGGER prepared_quiz_lock_membership_change ON prepared_quiz_group_members;
DROP FUNCTION prepared_quiz_lock_membership_change();
DROP TRIGGER prepared_quiz_guard_student_start ON assessment_attempts;
DROP FUNCTION prepared_quiz_guard_student_start();
DROP TRIGGER prepared_quiz_remember_activation ON prepared_quiz_distributions;
DROP FUNCTION prepared_quiz_remember_activation();
DROP FUNCTION prepared_quiz_is_eligible(uuid,uuid,integer);
COMMIT;
