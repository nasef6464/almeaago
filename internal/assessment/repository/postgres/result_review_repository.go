package postgres

import (
	"context"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func (r *Repository) ListResults(ctx context.Context, student string, page, limit int) (assessment.ResultPage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			x.id::text,
			x.assessment_id::text,
			x.assessment_version,
			v.title,
			x.attempt_number,
			z.score,
			z.total_questions,
			z.correct_answers,
			z.wrong_answers,
			z.unanswered,
			z.passed,
			z.time_spent_seconds,
			z.finalized_at
		FROM assessment_results z
		JOIN assessment_attempts x ON x.id=z.attempt_id
		JOIN assessment_versions v
		  ON v.assessment_id=x.assessment_id
		 AND v.version=x.assessment_version
		WHERE z.student_id=$1::uuid
		ORDER BY z.finalized_at DESC,z.attempt_id DESC
		LIMIT $2 OFFSET $3
	`, student, limit+1, (page-1)*limit)
	if err != nil {
		return assessment.ResultPage{}, err
	}
	defer rows.Close()

	out := assessment.ResultPage{Page: page, Limit: limit}
	for rows.Next() {
		var x assessment.ResultListItem
		if err = rows.Scan(
			&x.AttemptID,
			&x.AssessmentID,
			&x.AssessmentVersion,
			&x.Title,
			&x.AttemptNumber,
			&x.Score,
			&x.TotalQuestions,
			&x.CorrectAnswers,
			&x.WrongAnswers,
			&x.Unanswered,
			&x.Passed,
			&x.TimeSpentSeconds,
			&x.FinalizedAt,
		); err != nil {
			return out, err
		}
		out.Items = append(out.Items, x)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, nil
}

func (r *Repository) GetResultDetail(ctx context.Context, student, attemptID string) (assessment.ResultDetail, error) {
	var out assessment.ResultDetail
	var randomizeQuestions bool
	var randomizeOptions bool
	err := r.db.QueryRow(ctx, `
		SELECT
			z.attempt_id::text,
			z.score,
			z.total_questions,
			z.correct_answers,
			z.wrong_answers,
			z.unanswered,
			z.passed,
			z.time_spent_seconds,
			z.finalized_at,
			x.assessment_id::text,
			x.assessment_version,
			v.title,
			x.attempt_number,
			v.allow_question_review,
			v.show_answers,
			v.show_explanations,
			v.show_results_report,
			v.randomize_questions,
			v.randomize_options
		FROM assessment_results z
		JOIN assessment_attempts x ON x.id=z.attempt_id
		JOIN assessment_versions v
		  ON v.assessment_id=x.assessment_id
		 AND v.version=x.assessment_version
		WHERE z.attempt_id=$1::uuid
		  AND z.student_id=$2::uuid
	`, attemptID, student).Scan(
		&out.Result.AttemptID,
		&out.Result.Score,
		&out.Result.TotalQuestions,
		&out.Result.CorrectAnswers,
		&out.Result.WrongAnswers,
		&out.Result.Unanswered,
		&out.Result.Passed,
		&out.Result.TimeSpentSeconds,
		&out.Result.FinalizedAt,
		&out.AssessmentID,
		&out.AssessmentVersion,
		&out.Title,
		&out.AttemptNumber,
		&out.AllowQuestionReview,
		&out.ShowAnswers,
		&out.ShowExplanations,
		&out.ShowResultsReport,
		&randomizeQuestions,
		&randomizeOptions,
	)
	if err != nil {
		return out, mapError(err)
	}
	if !out.AllowQuestionReview {
		return out, nil
	}

	rows, err := r.db.Query(ctx, `
		SELECT
			aq.question_id::text,
			aq.question_version,
			COALESCE(aq.section_id::text,''),
			aq.sort_order,
			aq.points,
			qv.question_type,
			qv.text_content,
			COALESCE(qv.image_asset_id::text,''),
			qv.image_alt,
			qv.options_embedded_in_image,
			COALESCE(qv.video_url,''),
			COALESCE(qv.difficulty,''),
			aa.selected_option_index,
			COALESCE(aa.is_correct,false),
			COALESCE(aa.marked_for_review,false),
			COALESCE(aa.time_spent_seconds,0),
			qv.correct_option_index,
			qv.explanation,
			qv.hint,
			qv.solving_strategy
		FROM assessment_version_questions aq
		JOIN question_versions qv
		  ON qv.question_id=aq.question_id
		 AND qv.version=aq.question_version
		LEFT JOIN assessment_answers aa
		  ON aa.attempt_id=$3::uuid
		 AND aa.question_id=aq.question_id
		 AND aa.question_version=aq.question_version
		WHERE aq.assessment_id=$1::uuid
		  AND aq.assessment_version=$2
		ORDER BY
			CASE WHEN $4
				THEN md5($3||aq.question_id::text)
				ELSE lpad(aq.sort_order::text,12,'0')
			END,
			aq.question_id
	`, out.AssessmentID, out.AssessmentVersion, attemptID, randomizeQuestions)
	if err != nil {
		return out, err
	}
	defer rows.Close()

	questionIndex := make(map[string]int)
	for rows.Next() {
		var q assessment.ReviewQuestion
		var canonicalCorrect *int
		var explanation, hint, solvingStrategy string
		if err = rows.Scan(
			&q.QuestionID,
			&q.QuestionVersion,
			&q.SectionID,
			&q.SortOrder,
			&q.Points,
			&q.Type,
			&q.Text,
			&q.ImageAssetID,
			&q.ImageAlt,
			&q.OptionsEmbeddedInImage,
			&q.VideoURL,
			&q.Difficulty,
			&q.SelectedOptionIndex,
			&q.Correct,
			&q.MarkedForReview,
			&q.TimeSpentSeconds,
			&canonicalCorrect,
			&explanation,
			&hint,
			&solvingStrategy,
		); err != nil {
			return out, err
		}
		q.Answered = q.SelectedOptionIndex != nil
		applyReviewPolicy(
			&q,
			canonicalCorrect,
			explanation,
			hint,
			solvingStrategy,
			out.ShowAnswers,
			out.ShowExplanations,
		)
		questionIndex[q.QuestionID] = len(out.Questions)
		out.Questions = append(out.Questions, q)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}

	optionRows, err := r.db.Query(ctx, `
		SELECT
			qo.question_id::text,
			qo.option_index,
			qo.option_text,
			COALESCE(qo.asset_id::text,'')
		FROM assessment_version_questions aq
		JOIN question_options qo
		  ON qo.question_id=aq.question_id
		 AND qo.version=aq.question_version
		WHERE aq.assessment_id=$1::uuid
		  AND aq.assessment_version=$2
		ORDER BY
			CASE WHEN $3
				THEN md5($4||qo.option_index::text)
				ELSE lpad(qo.option_index::text,12,'0')
			END,
			qo.question_id,
			qo.option_index
	`, out.AssessmentID, out.AssessmentVersion, randomizeOptions, attemptID)
	if err != nil {
		return out, err
	}
	defer optionRows.Close()

	for optionRows.Next() {
		var questionID string
		var option assessment.LearnerOption
		if err = optionRows.Scan(&questionID, &option.Index, &option.Text, &option.AssetID); err != nil {
			return out, err
		}
		index, ok := questionIndex[questionID]
		if !ok {
			continue
		}
		out.Questions[index].Options = append(out.Questions[index].Options, option)
	}
	if err = optionRows.Err(); err != nil {
		return out, err
	}
	return out, nil
}

func applyReviewPolicy(
	q *assessment.ReviewQuestion,
	canonicalCorrect *int,
	explanation string,
	hint string,
	solvingStrategy string,
	showAnswers bool,
	showExplanations bool,
) {
	if showAnswers {
		q.CorrectOptionIndex = canonicalCorrect
	}
	if showExplanations {
		q.Explanation = explanation
		q.Hint = hint
		q.SolvingStrategy = solvingStrategy
	}
}
