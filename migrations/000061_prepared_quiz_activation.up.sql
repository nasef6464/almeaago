BEGIN;

-- Readiness is shared by the activation gate, learner list and start guard.
CREATE FUNCTION prepared_quiz_ready(p_assessment uuid,p_version integer)
RETURNS boolean LANGUAGE sql VOLATILE AS $$
 WITH RECURSIVE visible_paths AS (
  SELECT id FROM paths WHERE parent_path_id IS NULL AND status='active' AND COALESCE(presentation->>'isVisible','true')<>'false'
  UNION ALL SELECT p.id FROM paths p JOIN visible_paths parent ON p.parent_path_id=parent.id
  WHERE p.status='active' AND COALESCE(p.presentation->>'isVisible','true')<>'false'
 )
 SELECT EXISTS (
  SELECT 1 FROM prepared_quiz_distributions d
  JOIN assessments a ON a.id=d.assessment_id
  JOIN assessment_versions v ON v.assessment_id=a.id AND v.version=a.published_version
  JOIN visible_paths p ON p.id=v.path_id
  LEFT JOIN subjects s ON s.id=v.subject_id AND s.path_id=p.id
  LEFT JOIN levels l ON l.id=s.level_id AND l.path_id=p.id
  WHERE a.id=p_assessment AND v.version=p_version
   AND a.workflow_status='approved' AND a.is_published AND a.is_visible
   AND v.version_status='published' AND v.assessment_kind='normal'
   AND (v.subject_id IS NULL OR (s.status='active' AND COALESCE(s.presentation->>'isVisible','true')<>'false' AND (s.level_id IS NULL OR (l.status='active' AND COALESCE(l.presentation->>'isVisible','true')<>'false'))))
   AND (d.due_exclusive IS NULL OR d.due_exclusive>clock_timestamp())
   AND EXISTS (SELECT 1 FROM assessment_version_questions aq WHERE aq.assessment_id=a.id AND aq.assessment_version=v.version)
   AND NOT EXISTS (SELECT 1 FROM assessment_version_questions aq LEFT JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version WHERE aq.assessment_id=a.id AND aq.assessment_version=v.version AND (qv.question_id IS NULL OR qv.correct_option_index IS NULL))
   AND ((d.audience_type='public' AND NOT EXISTS (SELECT 1 FROM prepared_quiz_target_users tu WHERE tu.assessment_id=a.id) AND NOT EXISTS (SELECT 1 FROM prepared_quiz_target_groups tg WHERE tg.assessment_id=a.id))
     OR (d.audience_type='targeted' AND (EXISTS (SELECT 1 FROM prepared_quiz_target_users tu WHERE tu.assessment_id=a.id) OR EXISTS (SELECT 1 FROM prepared_quiz_target_groups tg WHERE tg.assessment_id=a.id))))
 )
$$;

CREATE OR REPLACE FUNCTION prepared_quiz_is_eligible(p_assessment uuid,p_student uuid,p_version integer)
RETURNS boolean LANGUAGE sql VOLATILE AS $$
 SELECT COALESCE(p_student IS NOT NULL AND prepared_quiz_ready(p_assessment,p_version) AND EXISTS (
  SELECT 1 FROM prepared_quiz_distributions d WHERE d.assessment_id=p_assessment AND d.enabled
   AND (d.audience_type='public' OR (d.audience_type='targeted' AND (
    EXISTS (SELECT 1 FROM prepared_quiz_target_users tu WHERE tu.assessment_id=p_assessment AND tu.user_id=p_student)
    OR EXISTS (SELECT 1 FROM prepared_quiz_target_groups tg JOIN prepared_quiz_group_members gm ON gm.group_id=tg.group_id WHERE tg.assessment_id=p_assessment AND gm.user_id=p_student)
   )))
 ),false)
$$;

CREATE FUNCTION prepared_quiz_validate_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE published integer;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.enabled THEN RAISE EXCEPTION 'stage prepared distribution before enabling' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF (OLD.enabled OR NEW.enabled) AND (OLD.mode,OLD.audience_type,OLD.due_exclusive) IS DISTINCT FROM (NEW.mode,NEW.audience_type,NEW.due_exclusive) THEN
  RAISE EXCEPTION 'disable distribution before changing details' USING ERRCODE='23514';
 END IF;
 IF NEW.enabled AND NOT OLD.enabled THEN
  SELECT published_version INTO published FROM assessments WHERE id=NEW.assessment_id;
  IF NOT prepared_quiz_ready(NEW.assessment_id,published) THEN RAISE EXCEPTION 'prepared distribution is not ready' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prepared_quiz_validate_transition BEFORE INSERT OR UPDATE ON prepared_quiz_distributions
 FOR EACH ROW EXECUTE FUNCTION prepared_quiz_validate_transition();

ALTER TABLE prepared_quiz_distributions DROP CONSTRAINT prepared_quiz_distributions_enabled_check;
COMMIT;
