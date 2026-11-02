package postgres

import (
	"context"
	"errors"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

// resultSkillAnalysis reads the submission-time evidence snapshot. It does not
// rebuild old attempts from current question-skill links or cumulative progress.
func (r *Repository) resultSkillAnalysis(ctx context.Context, student, attemptID string, resultTotal int) (*assessment.ResultSkillAnalysis, error) {
	analysis := &assessment.ResultSkillAnalysis{Items: []assessment.ResultSkillAnalysisItem{}}
	rows, err := r.db.Query(ctx, `
		WITH expected AS (
		 SELECT aq.question_id,aq.question_version,x.assessment_id,x.assessment_version,v.path_id
		 FROM assessment_attempts x
		 JOIN assessment_versions v ON v.assessment_id=x.assessment_id AND v.version=x.assessment_version
		 JOIN assessment_version_questions aq ON aq.assessment_id=x.assessment_id AND aq.assessment_version=x.assessment_version
		 WHERE x.id=$1::uuid AND x.student_id=$2::uuid AND x.status='submitted'
		), evidence AS (
		 SELECT e.question_id,me.id,me.path_id,me.subject_id,subj.name AS subject_name,me.answered,me.is_correct
		 FROM expected e
		 LEFT JOIN mastery_evidence me ON me.source_attempt_id=$1::uuid AND me.student_id=$2::uuid
		   AND me.evidence_type='assessment' AND me.question_id=e.question_id AND me.question_version=e.question_version
		   AND me.assessment_id=e.assessment_id AND me.assessment_version=e.assessment_version AND me.path_id=e.path_id
		 LEFT JOIN subjects subj ON subj.id=me.subject_id AND subj.path_id=me.path_id
		 WHERE me.id IS NULL OR subj.id IS NOT NULL
		), linked AS (
		 SELECT e.*,mes.skill_id,s.name AS skill_name,s.subject_id AS skill_subject
		 FROM evidence e
		 LEFT JOIN mastery_evidence_skills mes ON mes.evidence_id=e.id
		 LEFT JOIN skills s ON s.id=mes.skill_id
		), coverage AS (
		 SELECT (SELECT count(*) FROM expected)::int AS expected_count,
		        (SELECT count(DISTINCT question_id) FROM expected)::int AS distinct_expected,
		        count(DISTINCT question_id) FILTER (WHERE id IS NOT NULL)::int AS found_count,
		        count(DISTINCT id)::int AS evidence_count,
		        COALESCE(bool_or((id IS NOT NULL AND NULLIF(trim(subject_name),'') IS NULL) OR (skill_id IS NOT NULL AND (skill_subject IS DISTINCT FROM subject_id OR NULLIF(trim(skill_name),'') IS NULL))),false) AS invalid_skill
		 FROM linked
		), grouped AS (
		 SELECT path_id,subject_id,subject_name,skill_id,skill_name,count(*)::int AS question_count,
		        count(*) FILTER (WHERE answered AND is_correct)::int AS correct_count
		 FROM linked WHERE id IS NOT NULL AND skill_id IS NOT NULL
		 GROUP BY path_id,subject_id,subject_name,skill_id,skill_name
		)
		SELECT c.expected_count,c.distinct_expected,c.found_count,c.evidence_count,c.invalid_skill,
		       COALESCE(g.path_id::text,''),COALESCE(g.subject_id::text,''),COALESCE(g.subject_name,''),COALESCE(g.skill_id::text,''),
		       COALESCE(g.skill_name,''),COALESCE(g.question_count,0),COALESCE(g.correct_count,0)
		FROM coverage c LEFT JOIN grouped g ON true
		ORDER BY g.subject_id,g.skill_name,g.skill_id LIMIT 10001
	`, attemptID, student)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var expected, distinctExpected, found, evidenceCount int
		var invalid bool
		var item assessment.ResultSkillAnalysisItem
		if err = rows.Scan(&expected, &distinctExpected, &found, &evidenceCount, &invalid, &item.PathID, &item.SubjectID, &item.SubjectName, &item.SkillID, &item.SkillName, &item.QuestionCount, &item.CorrectCount); err != nil {
			return nil, err
		}
		analysis.Complete = expected > 0 && expected == resultTotal && distinctExpected == expected && found == expected && evidenceCount == expected && !invalid
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
	if !analysis.Complete || len(analysis.Items) > 10000 {
		analysis.Complete = false
		analysis.Items = []assessment.ResultSkillAnalysisItem{}
		return analysis, nil
	}
	rows.Close()
	if err := r.attachResultFoundationTopics(ctx, analysis.Items); err != nil {
		return nil, err
	}
	return analysis, nil
}

// Resolve only explicit current mappings in the skill's own active scope.
// The destination remains subject to the learner topic and placement checks.
func (r *Repository) attachResultFoundationTopics(ctx context.Context, items []assessment.ResultSkillAnalysisItem) error {
	if len(items) == 0 {
		return nil
	}
	ids := make([]string, 0, len(items))
	index := make(map[string]int, len(items))
	for i := range items {
		items[i].FoundationTopics = []assessment.ResultFoundationTopic{}
		ids = append(ids, items[i].SkillID)
		index[items[i].PathID+":"+items[i].SubjectID+":"+items[i].SkillID] = i
	}
	rows, err := r.db.Query(ctx, `
		SELECT t.path_id::text,t.subject_id::text,l.skill_id::text,t.id::text,t.title,t.is_locked
		FROM topic_skill_links l
		JOIN foundation_topics t ON t.id=l.topic_id
		JOIN skills s ON s.id=l.skill_id AND s.subject_id=t.subject_id
		JOIN subjects subj ON subj.id=t.subject_id AND subj.path_id=t.path_id AND subj.status='active'
		JOIN paths p ON p.id=t.path_id AND p.status='active'
		WHERE l.skill_id=ANY($1::uuid[]) AND t.status='active' AND t.is_visible=true
		ORDER BY t.sort_order,t.id,l.skill_id LIMIT 10001
	`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	count := 0
	for rows.Next() {
		count++
		if count > 10000 {
			return errors.New("too many foundation topic mappings in result")
		}
		var path, subject, skill string
		var topic assessment.ResultFoundationTopic
		if err := rows.Scan(&path, &subject, &skill, &topic.ID, &topic.Title, &topic.IsLocked); err != nil {
			return err
		}
		if i, ok := index[path+":"+subject+":"+skill]; ok {
			items[i].FoundationTopics = append(items[i].FoundationTopics, topic)
		}
	}
	return rows.Err()
}

func resultSkillBand(correct, total int) (int, string) {
	mastery := (100*correct + total/2) / total
	switch {
	case mastery >= 80:
		return mastery, "strong"
	case mastery >= 50:
		return mastery, "average"
	default:
		return mastery, "weak"
	}
}
