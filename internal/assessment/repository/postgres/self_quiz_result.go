package postgres

import (
	"context"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func (r *Repository) getSelfQuizResultDetail(ctx context.Context, student, id string) (assessment.ResultDetail, error) {
	var out assessment.ResultDetail
	err := r.db.QueryRow(ctx, `SELECT z.attempt_id::text,z.score,z.total_questions,z.correct_answers,z.wrong_answers,z.unanswered,z.passed,z.time_spent_seconds,z.finalized_at,x.attempt_number FROM assessment_results z JOIN assessment_attempts x ON x.id=z.attempt_id WHERE z.self_attempt_id=$1::uuid AND z.student_id=$2::uuid AND x.student_id=$2::uuid AND x.status='submitted'`, id, student).Scan(&out.Result.AttemptID, &out.Result.Score, &out.Result.TotalQuestions, &out.Result.CorrectAnswers, &out.Result.WrongAnswers, &out.Result.Unanswered, &out.Result.Passed, &out.Result.TimeSpentSeconds, &out.Result.FinalizedAt, &out.AttemptNumber)
	if err != nil {
		return out, mapError(err)
	}
	out.Title = "اختبار ذاتي"
	out.AllowQuestionReview, out.ShowAnswers, out.ShowExplanations, out.ShowResultsReport = true, true, true, true
	out.SkillAnalysis, err = r.selfQuizSkillAnalysis(ctx, student, id, out.Result.TotalQuestions)
	if err != nil {
		return out, err
	}
	rows, err := r.db.Query(ctx, `SELECT sq.question_id::text,sq.question_version,sq.sort_order,sq.points,qv.question_type,qv.text_content,COALESCE(qv.image_asset_id::text,''),COALESCE(a.public_url,''),qv.image_alt,qv.options_embedded_in_image,COALESCE(qv.video_url,''),COALESCE(qv.source_meta->>'passage',''),COALESCE(qv.difficulty,''),jsonb_build_object('learnerPresentation',qv.source_meta->'learnerPresentation'),aa.selected_option_index,COALESCE(aa.is_correct,false),COALESCE(aa.marked_for_review,false),COALESCE(aa.time_spent_seconds,0),qv.correct_option_index,qv.explanation,qv.hint,qv.solving_strategy FROM self_quiz_questions sq JOIN question_versions qv ON qv.question_id=sq.question_id AND qv.version=sq.question_version LEFT JOIN assets a ON a.id=qv.image_asset_id LEFT JOIN assessment_answers aa ON aa.self_attempt_id=sq.attempt_id AND aa.question_id=sq.question_id AND aa.question_version=sq.question_version WHERE sq.attempt_id=$1::uuid ORDER BY sq.sort_order,sq.question_id`, id)
	if err != nil {
		return out, err
	}
	index := map[string]int{}
	for rows.Next() {
		var q assessment.ReviewQuestion
		var correct *int
		var presentation []byte
		var explanation, hint, strategy string
		if err = rows.Scan(&q.QuestionID, &q.QuestionVersion, &q.SortOrder, &q.Points, &q.Type, &q.Text, &q.ImageAssetID, &q.ImageURL, &q.ImageAlt, &q.OptionsEmbeddedInImage, &q.VideoURL, &q.Passage, &q.Difficulty, &presentation, &q.SelectedOptionIndex, &q.Correct, &q.MarkedForReview, &q.TimeSpentSeconds, &correct, &explanation, &hint, &strategy); err != nil {
			rows.Close()
			return out, err
		}
		q.LearnerPresentation = learnerPresentation(presentation)
		q.Answered = q.SelectedOptionIndex != nil
		applyReviewPolicy(&q, correct, explanation, hint, strategy, true, true)
		index[q.QuestionID] = len(out.Questions)
		out.Questions = append(out.Questions, q)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return out, err
	}
	options, err := r.db.Query(ctx, `SELECT qo.question_id::text,qo.option_index,qo.option_text,COALESCE(qo.asset_id::text,'') FROM self_quiz_questions sq JOIN question_options qo ON qo.question_id=sq.question_id AND qo.version=sq.question_version WHERE sq.attempt_id=$1::uuid ORDER BY sq.sort_order,qo.option_index`, id)
	if err != nil {
		return out, err
	}
	defer options.Close()
	for options.Next() {
		var qid string
		var option assessment.LearnerOption
		if err = options.Scan(&qid, &option.Index, &option.Text, &option.AssetID); err != nil {
			return out, err
		}
		if i, ok := index[qid]; ok {
			out.Questions[i].Options = append(out.Questions[i].Options, option)
		}
	}
	if err = options.Err(); err != nil {
		return out, err
	}
	return out, nil
}
