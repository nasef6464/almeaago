-- name: ListSubjectsByPath :many
SELECT id,path_id,code,name,presentation,created_at,updated_at FROM subjects WHERE path_id=$1 ORDER BY name,id;
-- name: ListSkillsBySubject :many
SELECT id,subject_id,parent_skill_id,code,name,kind,sort_order,created_at,updated_at FROM skills WHERE subject_id=$1 ORDER BY sort_order,name,id;
