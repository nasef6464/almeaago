package postgres

import (
	"context"
	"errors"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

func (r *Repository) LearningSubmissionEvidence(ctx context.Context, student, attemptID string) (learning.SubmissionEvidence, error) {
	event := learning.SubmissionEvidence{StudentID: student, AttemptID: attemptID}
	self, err := r.isSelfQuizAttempt(ctx, attemptID)
	if err != nil {
		return event, err
	}
	if self {
		return r.selfQuizSubmissionEvidence(ctx, student, attemptID)
	}
	err = r.db.QueryRow(ctx, `
		SELECT a.assessment_id::text,a.assessment_version,v.path_id::text,COALESCE(v.subject_id::text,''),r.finalized_at
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
		       (aa.selected_option_index IS NOT NULL OR NULLIF(btrim(aa.text_answer),'') IS NOT NULL) AS answered,
		       COALESCE(aa.is_correct,false) AS correct,
		       COALESCE(qsl.skill_id::text,''),COALESCE(q.path_id::text,''),COALESCE(q.subject_id::text,''),
		       COALESCE(subject.path_id::text,''),COALESCE(skill.subject_id::text,'')
		FROM assessment_version_questions aq
		LEFT JOIN questions q ON q.id=aq.question_id
		LEFT JOIN subjects subject ON subject.id=q.subject_id
		LEFT JOIN assessment_answers aa
		  ON aa.attempt_id=$1::uuid AND aa.question_id=aq.question_id
		LEFT JOIN question_skill_links qsl ON qsl.question_id=aq.question_id
		LEFT JOIN skills skill ON skill.id=qsl.skill_id
		WHERE aq.assessment_id=$2::uuid AND aq.assessment_version=$3
		ORDER BY aq.sort_order,aq.question_id,qsl.skill_id
	`, attemptID, event.AssessmentID, event.AssessmentVersion)
	if err != nil {
		return event, err
	}
	defer rows.Close()

	index := map[string]int{}
	for rows.Next() {
		var questionID, skillID, pathID, subjectID, subjectPathID, skillSubjectID string
		var version int
		var answered, correct bool
		if err = rows.Scan(&questionID, &version, &answered, &correct, &skillID, &pathID, &subjectID, &subjectPathID, &skillSubjectID); err != nil {
			return event, err
		}
		if pathID == "" || subjectID == "" || pathID != event.PathID || subjectPathID != pathID ||
			(event.SubjectID != "" && subjectID != event.SubjectID) || (skillID != "" && skillSubjectID != subjectID) {
			return event, errors.New("assessment question evidence has invalid source scope")
		}
		position, ok := index[questionID]
		if !ok {
			position = len(event.Questions)
			index[questionID] = position
			event.Questions = append(event.Questions, learning.QuestionEvidence{
				QuestionID: questionID, QuestionVersion: version, Answered: answered, Correct: correct,
				PathID: pathID, SubjectID: subjectID,
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

// selfQuizSubmissionEvidence reads the immutable attempt snapshot rather than
// today's question-skill links, and allows the general quiz to span paths.
func (r *Repository) selfQuizSubmissionEvidence(ctx context.Context, student, attemptID string) (learning.SubmissionEvidence, error) {
	event := learning.SubmissionEvidence{StudentID: student, AttemptID: attemptID, SourceKind: "self"}
	err := r.db.QueryRow(ctx, `SELECT COALESCE(s.path_id::text,''),COALESCE(s.subject_id::text,''),s.evidence_type,r.finalized_at
		FROM assessment_attempts a JOIN self_quiz_settings s ON s.attempt_id=a.id
		JOIN assessment_results r ON r.attempt_id=a.id AND r.student_id=a.student_id
		WHERE a.id=$1::uuid AND a.student_id=$2::uuid AND a.attempt_kind='self' AND a.status='submitted'`, attemptID, student).Scan(&event.PathID, &event.SubjectID, &event.EvidenceType, &event.OccurredAt)
	if err != nil {
		return event, mapError(err)
	}
	rows, err := r.db.Query(ctx, `SELECT q.question_id::text,q.question_version,q.path_id::text,q.subject_id::text,
		(aa.selected_option_index IS NOT NULL OR NULLIF(btrim(aa.text_answer),'') IS NOT NULL),COALESCE(aa.is_correct,false),COALESCE(s.skill_id::text,'')
		FROM self_quiz_questions q LEFT JOIN assessment_answers aa ON aa.self_attempt_id=q.attempt_id AND aa.question_id=q.question_id AND aa.question_version=q.question_version
		LEFT JOIN self_quiz_question_skills s ON s.attempt_id=q.attempt_id AND s.question_id=q.question_id
		WHERE q.attempt_id=$1::uuid ORDER BY q.sort_order,q.question_id,s.skill_id`, attemptID)
	if err != nil {
		return event, err
	}
	defer rows.Close()
	event.Questions = []learning.QuestionEvidence{}
	indices := map[string]int{}
	for rows.Next() {
		var item learning.QuestionEvidence
		var skill string
		if err = rows.Scan(&item.QuestionID, &item.QuestionVersion, &item.PathID, &item.SubjectID, &item.Answered, &item.Correct, &skill); err != nil {
			return event, err
		}
		if item.PathID == "" || item.SubjectID == "" || (event.PathID != "" && event.PathID != item.PathID) || (event.SubjectID != "" && event.SubjectID != item.SubjectID) {
			return event, errors.New("self quiz question evidence has invalid source scope")
		}
		index, ok := indices[item.QuestionID]
		if !ok {
			index = len(event.Questions)
			indices[item.QuestionID] = index
			event.Questions = append(event.Questions, item)
		}
		if skill != "" {
			event.Questions[index].SkillIDs = append(event.Questions[index].SkillIDs, skill)
		}
	}
	return event, rows.Err()
}
