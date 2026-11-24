package postgres

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"sort"
	"strconv"
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
		// video_url is the solution explanation, not question content.
		// Never deliver it to an in-progress learner attempt.
		q.VideoURL = ""
		q.Options = []assessment.LearnerOption{}
		questions = append(questions, q)
	}
	err := rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	if len(questions) == 0 {
		return questions, nil
	}

	questionIDs := make([]string, len(questions))
	versions := make([]int, len(questions))
	for i, q := range questions {
		questionIDs[i] = q.ID
		versions[i] = q.Version
	}

	// Single batch query eliminating N+1 roundtrips across connection pool
	optionsRows, e := r.db.Query(ctx, `
		SELECT qo.question_id::text, qo.version, qo.option_index, qo.option_text, COALESCE(qo.asset_id::text, '')
		FROM question_options qo
		JOIN unnest($1::uuid[], $2::int[]) AS q(id, ver)
		  ON qo.question_id = q.id AND qo.version = q.ver
		ORDER BY qo.question_id, qo.option_index
	`, questionIDs, versions)
	if e != nil {
		return nil, e
	}
	defer optionsRows.Close()

	optionsByQuestion := make(map[string][]assessment.LearnerOption, len(questions))
	for optionsRows.Next() {
		var qID, optText, assetID string
		var ver, optIndex int
		if err := optionsRows.Scan(&qID, &ver, &optIndex, &optText, &assetID); err != nil {
			return nil, err
		}
		key := fmt.Sprintf("%s:%d", qID, ver)
		optionsByQuestion[key] = append(optionsByQuestion[key], assessment.LearnerOption{
			Index:   optIndex,
			Text:    optText,
			AssetID: assetID,
		})
	}
	if err := optionsRows.Err(); err != nil {
		return nil, err
	}

	for i := range questions {
		q := &questions[i]
		key := fmt.Sprintf("%s:%d", q.ID, q.Version)
		opts := optionsByQuestion[key]
		if opts == nil {
			q.Options = []assessment.LearnerOption{}
			continue
		}

		shouldRandomize := randomize && !q.OptionsEmbeddedInImage && !learnerQuestionHasImage(q.ImageAssetID, q.ImageURL, q.Text)
		if shouldRandomize {
			// Deterministically shuffle options based on md5(attemptID || option_index::text),
			// exactly matching PostgreSQL's ORDER BY md5($4||option_index::text)
			sort.SliceStable(opts, func(a, b int) bool {
				hashA := md5.Sum([]byte(attemptID + strconv.Itoa(opts[a].Index)))
				hashB := md5.Sum([]byte(attemptID + strconv.Itoa(opts[b].Index)))
				return hex.EncodeToString(hashA[:]) < hex.EncodeToString(hashB[:])
			})
		} else {
			// Standard ascending order matching lpad(option_index::text, 12, '0')
			sort.SliceStable(opts, func(a, b int) bool {
				return opts[a].Index < opts[b].Index
			})
		}
		q.Options = opts
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
