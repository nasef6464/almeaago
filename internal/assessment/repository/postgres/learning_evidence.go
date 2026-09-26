package postgres

import (
	"context"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

func (r *Repository) LearningSubmissionEvidence(ctx context.Context, student, attemptID string) (learning.SubmissionEvidence, error) {
	event := learning.SubmissionEvidence{StudentID: student, AttemptID: attemptID}
	err := r.db.QueryRow(ctx, `
		SELECT a.assessment_id::text,a.assessment_version,v.path_id::text,v.subject_id::text,r.finalized_at
		FROM assessment_attempts a
		JOIN assessment_results r ON r.attempt_id=a.id
		JOIN assessment_versions v ON v.assessment_id=a.assessment_id AND v.version=a.assessment_version
		WHERE a.id=$1::uuid AND a.student_id=$2::uuid AND a.status='submitted'
	`, attemptID, student).Scan(
		&event.AssessmentID, &event.AssessmentVersion, &event.PathID, &event.SubjectID, &event.OccurredAt,
	)
	if err != nil {
		return event, mapError(err)
	}

	event.Questions = []learning.QuestionEvidence{}
	rows, err := r.db.Query(ctx, `
		SELECT aq.question_id::text,aq.question_version,
		       (aa.question_id IS NOT NULL) AS answered,
		       COALESCE(aa.is_correct,false) AS correct,
		       COALESCE(qsl.skill_id::text,'')
		FROM assessment_version_questions aq
		LEFT JOIN assessment_answers aa
		  ON aa.attempt_id=$1::uuid AND aa.question_id=aq.question_id
		LEFT JOIN question_skill_links qsl ON qsl.question_id=aq.question_id
		WHERE aq.assessment_id=$2::uuid AND aq.assessment_version=$3
		ORDER BY aq.sort_order,aq.question_id,qsl.skill_id
	`, attemptID, event.AssessmentID, event.AssessmentVersion)
	if err != nil {
		return event, err
	}
	defer rows.Close()

	index := map[string]int{}
	for rows.Next() {
		var questionID, skillID string
		var version int
		var answered, correct bool
		if err = rows.Scan(&questionID, &version, &answered, &correct, &skillID); err != nil {
			return event, err
		}
		position, ok := index[questionID]
		if !ok {
			position = len(event.Questions)
			index[questionID] = position
			event.Questions = append(event.Questions, learning.QuestionEvidence{
				QuestionID: questionID, QuestionVersion: version, Answered: answered, Correct: correct,
			})
		}
		if skillID == "" {
			continue
		}
		duplicate := false
		for _, current := range event.Questions[position].SkillIDs {
			if current == skillID {
				duplicate = true
				break
			}
		}
		if !duplicate {
			event.Questions[position].SkillIDs = append(event.Questions[position].SkillIDs, skillID)
		}
	}
	return event, rows.Err()
}
