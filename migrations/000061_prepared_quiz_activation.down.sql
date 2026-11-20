BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM prepared_quiz_distributions WHERE enabled) THEN
  RAISE EXCEPTION 'disable prepared quizzes before rolling back activation';
 END IF;
END $$;
ALTER TABLE prepared_quiz_distributions ADD CONSTRAINT prepared_quiz_distributions_enabled_check CHECK (enabled=false);
DROP TRIGGER prepared_quiz_validate_transition ON prepared_quiz_distributions;
DROP FUNCTION prepared_quiz_validate_transition();
CREATE OR REPLACE FUNCTION prepared_quiz_is_eligible(p_assessment uuid,p_student uuid,p_version integer)
RETURNS boolean LANGUAGE sql VOLATILE AS $$
 WITH RECURSIVE visible_paths AS (
  SELECT id FROM paths WHERE parent_path_id IS NULL AND status='active' AND COALESCE(presentation->>'isVisible','true')<>'false'
  UNION ALL SELECT p.id FROM paths p JOIN visible_paths parent ON p.parent_path_id=parent.id WHERE p.status='active' AND COALESCE(p.presentation->>'isVisible','true')<>'false'
 )
 SELECT COALESCE(p_student IS NOT NULL AND EXISTS (
  SELECT 1 FROM prepared_quiz_distributions d JOIN assessments a ON a.id=d.assessment_id JOIN assessment_versions v ON v.assessment_id=a.id AND v.version=a.published_version JOIN visible_paths p ON p.id=v.path_id
  LEFT JOIN subjects s ON s.id=v.subject_id AND s.path_id=p.id LEFT JOIN levels l ON l.id=s.level_id AND l.path_id=p.id
  WHERE a.id=p_assessment AND v.version=p_version AND d.enabled AND a.workflow_status='approved' AND a.is_published AND a.is_visible AND v.version_status='published' AND v.assessment_kind='normal'
   AND (v.subject_id IS NULL OR (s.status='active' AND COALESCE(s.presentation->>'isVisible','true')<>'false' AND (s.level_id IS NULL OR (l.status='active' AND COALESCE(l.presentation->>'isVisible','true')<>'false'))))
   AND (d.due_exclusive IS NULL OR d.due_exclusive>clock_timestamp())
   AND EXISTS (SELECT 1 FROM assessment_version_questions aq JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version WHERE aq.assessment_id=a.id AND aq.assessment_version=v.version)
   AND (d.audience_type='public' OR (d.audience_type='targeted' AND (EXISTS (SELECT 1 FROM prepared_quiz_target_users tu WHERE tu.assessment_id=a.id AND tu.user_id=p_student) OR EXISTS (SELECT 1 FROM prepared_quiz_target_groups tg JOIN prepared_quiz_group_members gm ON gm.group_id=tg.group_id WHERE tg.assessment_id=a.id AND gm.user_id=p_student))))
 ),false)
$$;
DROP FUNCTION prepared_quiz_ready(uuid,integer);
COMMIT;
