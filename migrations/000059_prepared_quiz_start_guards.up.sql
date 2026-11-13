BEGIN;

-- Shared source of truth for listing and starting. A disabled draft never
-- grants access. The legacy due-date is stored as next local midnight UTC.
CREATE FUNCTION prepared_quiz_is_eligible(p_assessment uuid,p_student uuid,p_version integer)
RETURNS boolean LANGUAGE sql VOLATILE AS $$
 WITH RECURSIVE visible_paths AS (
  SELECT id FROM paths WHERE parent_path_id IS NULL AND status='active' AND COALESCE(presentation->>'isVisible','true')<>'false'
  UNION ALL SELECT p.id FROM paths p JOIN visible_paths parent ON p.parent_path_id=parent.id
  WHERE p.status='active' AND COALESCE(p.presentation->>'isVisible','true')<>'false'
 )
 SELECT COALESCE(p_student IS NOT NULL AND EXISTS (
  SELECT 1 FROM prepared_quiz_distributions d
  JOIN assessments a ON a.id=d.assessment_id
  JOIN assessment_versions v ON v.assessment_id=a.id AND v.version=a.published_version
  JOIN visible_paths p ON p.id=v.path_id
  LEFT JOIN subjects s ON s.id=v.subject_id AND s.path_id=p.id
  LEFT JOIN levels l ON l.id=s.level_id AND l.path_id=p.id
  WHERE a.id=p_assessment AND v.version=p_version AND d.enabled
   AND a.workflow_status='approved' AND a.is_published AND a.is_visible
   AND v.version_status='published' AND v.assessment_kind='normal'
   AND (v.subject_id IS NULL OR (s.status='active' AND COALESCE(s.presentation->>'isVisible','true')<>'false' AND (s.level_id IS NULL OR (l.status='active' AND COALESCE(l.presentation->>'isVisible','true')<>'false'))))
   AND (d.due_exclusive IS NULL OR d.due_exclusive>clock_timestamp())
   AND EXISTS (SELECT 1 FROM assessment_version_questions aq JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version WHERE aq.assessment_id=a.id AND aq.assessment_version=v.version)
   AND (d.audience_type='public' OR (d.audience_type='targeted' AND (
     EXISTS (SELECT 1 FROM prepared_quiz_target_users tu WHERE tu.assessment_id=a.id AND tu.user_id=p_student)
     OR EXISTS (SELECT 1 FROM prepared_quiz_target_groups tg JOIN prepared_quiz_group_members gm ON gm.group_id=tg.group_id WHERE tg.assessment_id=a.id AND gm.user_id=p_student)
   )))
 ),false)
$$;

-- Once made public, disabling a distribution must close direct starts too.
-- A never-enabled administrative draft leaves the pre-existing quiz alone.
CREATE FUNCTION prepared_quiz_remember_activation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.was_enabled THEN RAISE EXCEPTION 'cannot delete a previously enabled distribution' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 ELSIF TG_OP='INSERT' THEN NEW.was_enabled := NEW.was_enabled OR NEW.enabled;
 ELSE
  IF OLD.assessment_id<>NEW.assessment_id THEN RAISE EXCEPTION 'cannot move prepared distribution' USING ERRCODE='23514'; END IF;
  NEW.was_enabled := OLD.was_enabled OR NEW.was_enabled OR NEW.enabled;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prepared_quiz_remember_activation BEFORE INSERT OR UPDATE OR DELETE ON prepared_quiz_distributions
 FOR EACH ROW EXECUTE FUNCTION prepared_quiz_remember_activation();

CREATE FUNCTION prepared_quiz_guard_student_start() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active boolean; previously_active boolean;
BEGIN
 IF NEW.assessment_id IS NULL THEN RETURN NEW; END IF;
 -- Assessment lock serializes a new/changed distribution against a start.
 PERFORM 1 FROM assessments WHERE id=NEW.assessment_id FOR SHARE;
 SELECT enabled,was_enabled INTO active,previously_active FROM prepared_quiz_distributions WHERE assessment_id=NEW.assessment_id FOR SHARE;
 IF NOT COALESCE(active,false) THEN
  IF COALESCE(previously_active,false) THEN RAISE EXCEPTION 'prepared quiz access denied' USING ERRCODE='PZ001'; END IF;
  RETURN NEW;
 END IF;
 -- Group member writers lock the same rows before editing memberships.
 PERFORM g.id FROM prepared_quiz_groups g JOIN prepared_quiz_target_groups tg ON tg.group_id=g.id
  WHERE tg.assessment_id=NEW.assessment_id ORDER BY g.id FOR SHARE OF g;
 IF NOT prepared_quiz_is_eligible(NEW.assessment_id,NEW.student_id,NEW.assessment_version) THEN
  RAISE EXCEPTION 'prepared quiz access denied' USING ERRCODE='PZ001';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prepared_quiz_guard_student_start BEFORE INSERT ON assessment_attempts
 FOR EACH ROW EXECUTE FUNCTION prepared_quiz_guard_student_start();

-- Enforce the same lock for every membership writer, including future bulk
-- imports, not just the current administrative API.
CREATE FUNCTION prepared_quiz_lock_membership_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM id FROM prepared_quiz_groups WHERE id=NEW.group_id FOR UPDATE;
 ELSIF TG_OP='DELETE' THEN
  PERFORM id FROM prepared_quiz_groups WHERE id=OLD.group_id FOR UPDATE;
 ELSE
  PERFORM id FROM prepared_quiz_groups WHERE id IN (OLD.group_id,NEW.group_id) ORDER BY id FOR UPDATE;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER prepared_quiz_lock_membership_change BEFORE INSERT OR UPDATE OR DELETE ON prepared_quiz_group_members
 FOR EACH ROW EXECUTE FUNCTION prepared_quiz_lock_membership_change();

-- Prevent audience edits after activation, including future direct or bulk
-- writers. Administrators must disable and then revise the distribution.
CREATE FUNCTION prepared_quiz_guard_target_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_assessment uuid; active boolean;
BEGIN
 IF TG_OP='UPDATE' AND OLD.assessment_id<>NEW.assessment_id THEN
  RAISE EXCEPTION 'cannot move prepared audience target' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN target_assessment:=OLD.assessment_id; ELSE target_assessment:=NEW.assessment_id; END IF;
 PERFORM 1 FROM assessments WHERE id=target_assessment FOR SHARE;
 SELECT enabled INTO active FROM prepared_quiz_distributions WHERE assessment_id=target_assessment FOR UPDATE;
 IF COALESCE(active,false) THEN RAISE EXCEPTION 'disable distribution before changing targets' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER prepared_quiz_guard_target_users BEFORE INSERT OR UPDATE OR DELETE ON prepared_quiz_target_users
 FOR EACH ROW EXECUTE FUNCTION prepared_quiz_guard_target_change();
CREATE TRIGGER prepared_quiz_guard_target_groups BEFORE INSERT OR UPDATE OR DELETE ON prepared_quiz_target_groups
 FOR EACH ROW EXECUTE FUNCTION prepared_quiz_guard_target_change();

-- Anonymous live sessions cannot establish the legacy signed-in audience.
CREATE FUNCTION prepared_quiz_guard_public_start() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active boolean; previously_active boolean;
BEGIN
 PERFORM 1 FROM assessments WHERE id=NEW.assessment_id FOR SHARE;
 SELECT enabled,was_enabled INTO active,previously_active FROM prepared_quiz_distributions WHERE assessment_id=NEW.assessment_id FOR SHARE;
 IF COALESCE(active,false) OR COALESCE(previously_active,false) THEN RAISE EXCEPTION 'prepared quiz access denied' USING ERRCODE='PZ001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prepared_quiz_guard_public_start BEFORE INSERT ON assessment_public_attempts
 FOR EACH ROW EXECUTE FUNCTION prepared_quiz_guard_public_start();

COMMIT;
