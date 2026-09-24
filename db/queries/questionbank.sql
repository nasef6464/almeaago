-- name: GetQuestionIdentityByCode :one
SELECT id,question_code,current_version,workflow_status,owner_type,owner_id,created_by,created_at,updated_at FROM questions WHERE question_code=$1;
-- name: ListQuestionSkillLinks :many
SELECT question_id,skill_id,relation_type,created_at FROM question_skill_links WHERE question_id=$1 ORDER BY relation_type,skill_id;
-- name: CountDistinctQuestionsForSkill :one
SELECT count(DISTINCT qsl.question_id)::bigint AS question_count
FROM question_skill_links qsl JOIN questions q ON q.id=qsl.question_id
WHERE qsl.skill_id=$1 AND q.workflow_status='approved';
