-- Read-only acceptance: run with psql -X -v ON_ERROR_STOP=1 against an explicitly selected database.
-- No connection string or credentials are stored in this file. No migration or data repair.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT 'questions' AS metric, count(*) AS count FROM questions
UNION ALL SELECT 'options', count(*) FROM question_options
UNION ALL SELECT 'lessons', count(*) FROM lessons
UNION ALL SELECT 'main_topics', count(*) FROM foundation_topics WHERE parent_topic_id IS NULL
UNION ALL SELECT 'sub_topics', count(*) FROM foundation_topics WHERE parent_topic_id IS NOT NULL
UNION ALL SELECT 'topic_lesson_links', count(*) FROM topic_lessons;
SELECT 'current_version_missing' AS metric, count(*) FROM questions q
LEFT JOIN question_versions v ON v.question_id=q.id AND v.version=q.current_version
WHERE v.question_id IS NULL;
-- Start from versions, so a version with ZERO options cannot disappear from the check.
-- Four-option requirement is scoped to MCQ; essay/true-false require their own rules.
SELECT 'invalid_mcq_options_or_answer' AS metric, count(*) FROM (
 SELECT v.question_id,v.version FROM question_versions v
 LEFT JOIN question_options o ON o.question_id=v.question_id AND o.version=v.version
 WHERE v.question_type='mcq'
 GROUP BY v.question_id,v.version,v.correct_option_index
 HAVING count(o.option_index)<>4
 OR count(o.option_index) FILTER(WHERE o.option_index=v.correct_option_index)<>1
) invalid;
SELECT workflow_status,lesson_type,count(*) AS lessons,
 count(*) FILTER(WHERE nullif(btrim(video_url),'') IS NOT NULL) AS video_urls,
 count(*) FILTER(WHERE nullif(btrim(recording_url),'') IS NOT NULL) AS recording_urls,
 count(*) FILTER(WHERE nullif(btrim(meeting_url),'') IS NOT NULL) AS meeting_urls,
 count(*) FILTER(WHERE nullif(btrim(content_text),'') IS NOT NULL) AS content_texts
FROM lessons GROUP BY workflow_status,lesson_type;
SELECT p.code AS path,s.code AS subject,count(*) AS questions FROM questions q
JOIN paths p ON p.id=q.path_id JOIN subjects s ON s.id=q.subject_id
WHERE q.import_batch_id='QDR_QNT_MNSF26_FULL_V1' GROUP BY p.code,s.code;
ROLLBACK;
