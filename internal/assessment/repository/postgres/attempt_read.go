package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func (r *Repository) isSelfQuizAttempt(ctx context.Context, id string) (bool, error) {
	var isSelf bool
	if err := r.db.QueryRow(ctx, `SELECT assessment_id IS NULL FROM assessment_attempts WHERE id=$1::uuid`, id).Scan(&isSelf); err != nil {
		return false, mapError(err)
	}
	return isSelf, nil
}

// readLearnerQuestions consumes the outer rows before loading options, so a
// single-connection pool can serve both prepared and self-quiz attempts.
func (r *Repository) readLearnerQuestions(ctx context.Context, rows pgx.Rows, attemptID string, randomize bool) ([]assessment.LearnerQuestion, error) {
	questions := []assessment.LearnerQuestion{}
	for rows.Next() {
		var q assessment.LearnerQuestion
		var presentation []byte
		if err := rows.Scan(&q.ID, &q.Version, &q.SectionID, &q.SortOrder, &q.Points, &q.Type, &q.Text, &q.ImageAssetID, &q.ImageURL, &q.ImageAlt, &q.OptionsEmbeddedInImage, &q.VideoURL, &q.Passage, &q.Difficulty, &presentation); err != nil {
			rows.Close()
			return nil, err
		}
		q.LearnerPresentation = learnerPresentation(presentation)
		q.Options = []assessment.LearnerOption{}
		questions = append(questions, q)
	}
	err := rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	for i := range questions {
		q := &questions[i]
		options, e := r.db.Query(ctx, `SELECT option_index,option_text,COALESCE(asset_id::text,'') FROM question_options WHERE question_id=$1::uuid AND version=$2 ORDER BY CASE WHEN $3 THEN md5($4||option_index::text) ELSE lpad(option_index::text,12,'0') END`, q.ID, q.Version, randomize && !q.OptionsEmbeddedInImage && !learnerQuestionHasImage(q.ImageAssetID, q.ImageURL, q.Text), attemptID)
		if e != nil {
			return nil, e
		}
		for options.Next() {
			var option assessment.LearnerOption
			if e = options.Scan(&option.Index, &option.Text, &option.AssetID); e != nil {
				break
			}
			q.Options = append(q.Options, option)
		}
		if e == nil {
			e = options.Err()
		}
		options.Close()
		if e != nil {
			return nil, e
		}
	}
	return questions, nil
}

func (r *Repository) readSavedAnswers(ctx context.Context, id string) ([]assessment.SavedAnswer, error) {
	rows, err := r.db.Query(ctx, `SELECT question_id::text,selected_option_index,COALESCE(text_answer,''),time_spent_seconds,marked_for_review,last_saved_at FROM assessment_answers WHERE attempt_id=$1::uuid ORDER BY last_saved_at,question_id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	answers := []assessment.SavedAnswer{}
	for rows.Next() {
		var answer assessment.SavedAnswer
		if err = rows.Scan(&answer.QuestionID, &answer.SelectedOptionIndex, &answer.TextAnswer, &answer.TimeSpentSeconds, &answer.MarkedForReview, &answer.LastSavedAt); err != nil {
			return nil, err
		}
		answers = append(answers, answer)
	}
	return answers, rows.Err()
}

func (r *Repository) getSelfQuizAttempt(ctx context.Context, id string) (assessment.Attempt, error) {
	a := assessment.Attempt{Title: "اختبار ذاتي", Kind: assessment.KindNormal, ShowProgressBar: true, AllowQuestionReview: true, ShowResultsReport: true, Sections: []assessment.Section{}}
	var expires, submitted *time.Time
	var serverTime time.Time
	err := r.db.QueryRow(ctx, `SELECT a.id::text,a.student_id::text,a.attempt_number,a.status,a.started_at,a.expires_at,a.submitted_at,clock_timestamp(),(SELECT count(*) FROM self_quiz_questions q WHERE q.attempt_id=a.id) FROM assessment_attempts a JOIN self_quiz_settings s ON s.attempt_id=a.id WHERE a.id=$1::uuid AND a.attempt_kind='self'`, id).Scan(&a.ID, &a.StudentID, &a.AttemptNumber, &a.Status, &a.StartedAt, &expires, &submitted, &serverTime, &a.TotalQuestions)
	if err != nil {
		return a, mapError(err)
	}
	a.ExpiresAt, a.SubmittedAt = expires, submitted
	a.ServerTime = &serverTime
	if a.Status == assessment.AttemptInProgress && expires != nil && !serverTime.Before(*expires) {
		a.Status = assessment.AttemptExpired
	}
	rows, err := r.db.Query(ctx, `SELECT aq.question_id::text,aq.question_version,''::text,aq.sort_order,aq.points,qv.question_type,qv.text_content,COALESCE(qv.image_asset_id::text,''),COALESCE(a.public_url,''),qv.image_alt,qv.options_embedded_in_image,''::text,COALESCE(qv.source_meta->>'passage',''),COALESCE(qv.difficulty,''),jsonb_build_object('learnerPresentation',qv.source_meta->'learnerPresentation') FROM self_quiz_questions aq JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version LEFT JOIN assets a ON a.id=qv.image_asset_id WHERE aq.attempt_id=$1::uuid ORDER BY aq.sort_order,aq.question_id`, id)
	if err != nil {
		return a, err
	}
	a.Questions, err = r.readLearnerQuestions(ctx, rows, a.ID, false)
	if err != nil {
		return a, err
	}
	a.Answers, err = r.readSavedAnswers(ctx, id)
	return a, err
}
