package postgres

import (
	"context"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

// Require complete, scoped evidence before presenting mastery as a fact.
func (r *Repository) selfQuizSkillAnalysis(ctx context.Context, student, id string, total int) (*assessment.ResultSkillAnalysis, error) {
	analysis := &assessment.ResultSkillAnalysis{Items: []assessment.ResultSkillAnalysisItem{}}
	rows, err := r.db.Query(ctx, `WITH expected AS (
 SELECT sq.question_id,sq.question_version,sq.path_id,sq.subject_id,s.evidence_type
 FROM self_quiz_questions sq JOIN self_quiz_settings s ON s.attempt_id=sq.attempt_id
 JOIN assessment_attempts x ON x.id=sq.attempt_id AND x.student_id=$2::uuid AND x.status='submitted'
 WHERE sq.attempt_id=$1::uuid
), evidence AS (
 SELECT e.*,me.id,me.answered,me.is_correct,sub.name AS subject_name
 FROM expected e LEFT JOIN mastery_evidence me ON me.self_attempt_id=$1::uuid AND me.student_id=$2::uuid AND me.evidence_type=e.evidence_type AND me.question_id=e.question_id AND me.question_version=e.question_version AND me.path_id=e.path_id AND me.subject_id=e.subject_id
 LEFT JOIN subjects sub ON sub.id=e.subject_id AND sub.path_id=e.path_id
), linked AS (
 SELECT e.*,mes.skill_id,s.name AS skill_name,s.subject_id AS skill_subject
 FROM evidence e LEFT JOIN mastery_evidence_skills mes ON mes.evidence_id=e.id LEFT JOIN skills s ON s.id=mes.skill_id
), coverage AS (
 SELECT (SELECT count(*) FROM expected)::int expected_count,count(DISTINCT question_id) FILTER(WHERE id IS NOT NULL)::int found_count,count(DISTINCT id)::int evidence_count,
 COALESCE(bool_or(NULLIF(trim(subject_name),'') IS NULL OR (skill_id IS NOT NULL AND (skill_subject IS DISTINCT FROM subject_id OR NULLIF(trim(skill_name),'') IS NULL))),false)
 OR EXISTS (SELECT 1 FROM evidence e JOIN self_quiz_question_skills sqs ON sqs.attempt_id=$1::uuid AND sqs.question_id=e.question_id WHERE e.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM mastery_evidence_skills mes WHERE mes.evidence_id=e.id AND mes.skill_id=sqs.skill_id))
 OR EXISTS (SELECT 1 FROM evidence e JOIN mastery_evidence_skills mes ON mes.evidence_id=e.id WHERE NOT EXISTS (SELECT 1 FROM self_quiz_question_skills sqs WHERE sqs.attempt_id=$1::uuid AND sqs.question_id=e.question_id AND sqs.skill_id=mes.skill_id)) AS invalid
 FROM linked
), grouped AS (
 SELECT path_id,subject_id,subject_name,skill_id,skill_name,count(*)::int question_count,count(*) FILTER(WHERE answered AND is_correct)::int correct_count
 FROM linked WHERE id IS NOT NULL AND skill_id IS NOT NULL GROUP BY path_id,subject_id,subject_name,skill_id,skill_name
)
SELECT c.expected_count,c.found_count,c.evidence_count,c.invalid,COALESCE(g.path_id::text,''),COALESCE(g.subject_id::text,''),COALESCE(g.subject_name,''),COALESCE(g.skill_id::text,''),COALESCE(g.skill_name,''),COALESCE(g.question_count,0),COALESCE(g.correct_count,0)
FROM coverage c LEFT JOIN grouped g ON true ORDER BY g.subject_id,g.skill_name,g.skill_id LIMIT 10001`, id, student)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var expected, found, evidence int
		var invalid bool
		var item assessment.ResultSkillAnalysisItem
		if err = rows.Scan(&expected, &found, &evidence, &invalid, &item.PathID, &item.SubjectID, &item.SubjectName, &item.SkillID, &item.SkillName, &item.QuestionCount, &item.CorrectCount); err != nil {
			return nil, err
		}
		analysis.Complete = expected > 0 && expected == total && found == expected && evidence == expected && !invalid
		if item.SkillID != "" {
			if item.QuestionCount < 1 || item.CorrectCount < 0 || item.CorrectCount > item.QuestionCount {
				analysis.Complete = false
				continue
			}
			item.Mastery, item.Status = resultSkillBand(item.CorrectCount, item.QuestionCount)
			analysis.Items = append(analysis.Items, item)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	if !analysis.Complete || len(analysis.Items) > 10000 {
		analysis.Complete = false
		analysis.Items = []assessment.ResultSkillAnalysisItem{}
		return analysis, nil
	}
	if err = r.attachResultFoundationTopics(ctx, analysis.Items); err != nil {
		return nil, err
	}
	return analysis, nil
}
