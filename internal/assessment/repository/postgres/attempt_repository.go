package postgres

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	"time"
)

func (r *Repository) GetPublishedAccessContext(ctx context.Context, assessmentID string) (assessment.AccessContext, error) {
	var out assessment.AccessContext
	err := r.db.QueryRow(ctx, `
WITH RECURSIVE public_paths AS (
 SELECT id FROM paths WHERE parent_path_id IS NULL AND status='active' AND COALESCE(presentation->>'isVisible','true') <> 'false'
 UNION ALL SELECT p.id FROM paths p JOIN public_paths parent ON p.parent_path_id=parent.id
 WHERE p.status='active' AND COALESCE(p.presentation->>'isVisible','true') <> 'false'
)
SELECT a.id::text,v.assessment_kind,v.access_type,v.path_id::text,COALESCE(v.subject_id::text,'')
FROM assessments a
JOIN assessment_versions v ON v.assessment_id=a.id AND v.version=a.published_version
JOIN public_paths p ON p.id=v.path_id
LEFT JOIN subjects s ON s.id=v.subject_id AND s.path_id=p.id
LEFT JOIN levels l ON l.id=s.level_id AND l.path_id=p.id
WHERE a.id=$1::uuid
  AND a.workflow_status='approved'
  AND a.is_published=true
  AND a.is_visible=true
  AND (v.subject_id IS NULL OR (s.status='active' AND COALESCE(s.presentation->>'isVisible','true') <> 'false' AND (s.level_id IS NULL OR (l.status='active' AND COALESCE(l.presentation->>'isVisible','true') <> 'false'))))
`, assessmentID).Scan(&out.AssessmentID, &out.AssessmentKind, &out.BaseAccess, &out.PathID, &out.SubjectID)
	if err != nil {
		return out, mapError(err)
	}
	out.PlacementAccess = assessment.PlacementAccessInherit
	return out, nil
}

func (r *Repository) FindDirectStart(ctx context.Context, student, assessmentID, startKey string) (assessment.Attempt, bool, error) {
	var id, existingStudent, existingAssessment string
	err := r.db.QueryRow(ctx, `
SELECT id::text,student_id::text,assessment_id::text
FROM assessment_attempts
WHERE start_key=$1
`, startKey).Scan(&id, &existingStudent, &existingAssessment)
	if errors.Is(err, pgx.ErrNoRows) {
		return assessment.Attempt{}, false, nil
	}
	if err != nil {
		return assessment.Attempt{}, false, err
	}
	if existingStudent != student || existingAssessment != assessmentID {
		return assessment.Attempt{}, false, assessment.ErrConflict
	}
	out, err := r.GetAttempt(ctx, id)
	if err != nil {
		return assessment.Attempt{}, false, err
	}
	return out, true, nil
}

func (r *Repository) Start(ctx context.Context, student, assessmentID, startKey string) (assessment.Attempt, error) {
	tx, e := r.db.Begin(ctx)
	if e != nil {
		return assessment.Attempt{}, e
	}
	defer tx.Rollback(ctx)
	var existingID, existingStudent, existingAssessment string
	e = tx.QueryRow(ctx, `SELECT id::text,student_id::text,assessment_id::text FROM assessment_attempts WHERE start_key=$1`, startKey).Scan(&existingID, &existingStudent, &existingAssessment)
	if e == nil {
		if existingStudent != student || existingAssessment != assessmentID {
			return assessment.Attempt{}, assessment.ErrConflict
		}
		if e = tx.Commit(ctx); e != nil {
			return assessment.Attempt{}, e
		}
		return r.GetAttempt(ctx, existingID)
	}
	if !errors.Is(e, pgx.ErrNoRows) {
		return assessment.Attempt{}, e
	}
	var version, maxAttempts int
	var limit *int
	e = tx.QueryRow(ctx, `SELECT a.published_version,v.max_attempts,v.time_limit_seconds FROM assessments a JOIN assessment_versions v ON v.assessment_id=a.id AND v.version=a.published_version WHERE a.id=$1::uuid AND a.workflow_status='approved' AND a.is_published AND a.is_visible FOR UPDATE OF a`, assessmentID).Scan(&version, &maxAttempts, &limit)
	if e != nil {
		return assessment.Attempt{}, mapError(e)
	}
	var invalid bool
	if e = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assessment_version_questions aq JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version WHERE aq.assessment_id=$1::uuid AND aq.assessment_version=$2 AND qv.correct_option_index IS NULL) OR NOT EXISTS(SELECT 1 FROM assessment_version_questions WHERE assessment_id=$1::uuid AND assessment_version=$2)`, assessmentID, version).Scan(&invalid); e != nil {
		return assessment.Attempt{}, e
	}
	if invalid {
		return assessment.Attempt{}, assessment.ErrConflict
	}
	var used int
	if e = tx.QueryRow(ctx, `SELECT count(*) FROM assessment_attempts WHERE assessment_id=$1::uuid AND assessment_version=$2 AND student_id=$3::uuid AND assignment_id IS NULL AND session_id IS NULL AND placement_id IS NULL`, assessmentID, version, student).Scan(&used); e != nil {
		return assessment.Attempt{}, e
	}
	if used >= maxAttempts {
		return assessment.Attempt{}, assessment.ErrConflict
	}
	var id string
	var expires *time.Time
	e = tx.QueryRow(ctx, `INSERT INTO assessment_attempts(assessment_id,assessment_version,student_id,attempt_number,start_key,expires_at) VALUES($1::uuid,$2,$3::uuid,$4,$5,CASE WHEN $6::int IS NULL THEN NULL ELSE now()+make_interval(secs=>$6) END) RETURNING id::text,expires_at`, assessmentID, version, student, used+1, startKey, limit).Scan(&id, &expires)
	if e != nil {
		return assessment.Attempt{}, mapError(e)
	}
	if e = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: student, Action: "assessment.attempt.start", ResourceType: "assessment_attempt", ResourceID: id, Metadata: map[string]any{"assessmentId": assessmentID, "version": version}}); e != nil {
		return assessment.Attempt{}, e
	}
	if e = tx.Commit(ctx); e != nil {
		return assessment.Attempt{}, e
	}
	return r.GetAttempt(ctx, id)
}

func (r *Repository) GetAttempt(ctx context.Context, id string) (assessment.Attempt, error) {
	isSelf, err := r.isSelfQuizAttempt(ctx, id)
	if err != nil {
		return assessment.Attempt{}, mapError(err)
	}
	if isSelf {
		return r.getSelfQuizAttempt(ctx, id)
	}
	var a assessment.Attempt
	a.Questions = []assessment.LearnerQuestion{}
	a.Answers = []assessment.SavedAnswer{}
	var expires, submitted *time.Time
	var sectionState []byte
	var serverTime time.Time
	e := r.db.QueryRow(ctx, `SELECT x.id::text,x.assessment_id::text,x.assessment_version,x.student_id::text,x.attempt_number,x.status,v.title,x.started_at,x.expires_at,x.submitted_at,v.show_progress_bar,v.require_answer_before_next,v.allow_question_review,v.randomize_options,v.show_results_report,v.assessment_kind,COALESCE(v.mock_presentation_mode,''),v.mock_strict_section_lock,x.section_state,clock_timestamp() FROM assessment_attempts x JOIN assessment_versions v ON v.assessment_id=x.assessment_id AND v.version=x.assessment_version WHERE x.id=$1::uuid`, id).Scan(&a.ID, &a.AssessmentID, &a.AssessmentVersion, &a.StudentID, &a.AttemptNumber, &a.Status, &a.Title, &a.StartedAt, &expires, &submitted, &a.ShowProgressBar, &a.RequireAnswerBeforeNext, &a.AllowQuestionReview, &a.RandomizeOptions, &a.ShowResultsReport, &a.Kind, &a.MockPresentationMode, &a.MockStrictSectionLock, &sectionState, &serverTime)
	if e != nil {
		return a, mapError(e)
	}
	if e = r.db.QueryRow(ctx, `SELECT count(*) FROM assessment_version_questions WHERE assessment_id=$1::uuid AND assessment_version=$2`, a.AssessmentID, a.AssessmentVersion).Scan(&a.TotalQuestions); e != nil {
		return a, e
	}
	a.ExpiresAt = expires
	a.ServerTime = &serverTime
	a.SubmittedAt = submitted
	if a.Status == assessment.AttemptInProgress && expires != nil && !serverTime.Before(*expires) {
		a.Status = assessment.AttemptExpired
	}
	a.Sections, e = loadAttemptSections(ctx, r.db, a.AssessmentID, a.AssessmentVersion)
	if e != nil {
		return a, e
	}
	strict := strictMode(a.Kind, a.MockPresentationMode, a.MockStrictSectionLock) && a.Status != assessment.AttemptSubmitted
	activeSection := ""
	if strict && a.Status == assessment.AttemptInProgress {
		stored, err := decodeStrictState(sectionState)
		if err != nil {
			return a, err
		}
		progress, err := resolveStrictSectionProgress(a.Sections, stored, a.StartedAt, serverTime)
		if err != nil {
			return a, err
		}
		a.SectionProgress = publicSectionProgress(progress, serverTime)
		activeSection = progress.CurrentSectionID
	}
	rows, e := r.db.Query(ctx, `SELECT aq.question_id::text,aq.question_version,COALESCE(aq.section_id::text,''),aq.sort_order,aq.points,qv.question_type,qv.text_content,COALESCE(qv.image_asset_id::text,''),COALESCE(a.public_url,''),qv.image_alt,qv.options_embedded_in_image,COALESCE(qv.video_url,''),COALESCE(qv.source_meta->>'passage',''),COALESCE(qv.difficulty,''),jsonb_build_object('learnerPresentation',qv.source_meta->'learnerPresentation') FROM assessment_version_questions aq JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version JOIN assessment_versions v ON v.assessment_id=aq.assessment_id AND v.version=aq.assessment_version LEFT JOIN assessment_sections sec ON sec.id=aq.section_id AND sec.assessment_id=aq.assessment_id AND sec.assessment_version=aq.assessment_version LEFT JOIN assets a ON a.id=qv.image_asset_id WHERE aq.assessment_id=$1::uuid AND aq.assessment_version=$2 AND (NOT $4::boolean OR COALESCE(aq.section_id::text,'')=$5) ORDER BY CASE WHEN v.assessment_kind='mock' THEN sec.sort_order ELSE 0 END NULLS LAST,CASE WHEN v.assessment_kind='mock' THEN sec.id ELSE NULL END,CASE WHEN v.randomize_questions THEN md5($3||aq.question_id::text) ELSE lpad(aq.sort_order::text,12,'0') END,aq.question_id`, a.AssessmentID, a.AssessmentVersion, a.ID, strict, activeSection)
	if e != nil {
		return a, e
	}
	a.Questions, e = r.readLearnerQuestions(ctx, rows, a.ID, a.RandomizeOptions)
	if e != nil {
		return a, e
	}
	a.Answers, e = r.readSavedAnswers(ctx, id)
	return a, e
}

func (r *Repository) SaveAnswer(ctx context.Context, student, id, qid string, w assessment.AnswerWrite) (assessment.Attempt, error) {
	isSelf, err := r.isSelfQuizAttempt(ctx, id)
	if err != nil {
		return assessment.Attempt{}, err
	}
	if isSelf {
		return r.saveSelfQuizAnswer(ctx, student, id, qid, w)
	}
	tx, e := r.db.Begin(ctx)
	if e != nil {
		return assessment.Attempt{}, e
	}
	defer tx.Rollback(ctx)
	var aid string
	var ver int
	var status assessment.AttemptStatus
	var expires *time.Time
	var started, serverTime time.Time
	var kind assessment.Kind
	var mode string
	var lock *bool
	var requireAnswer bool
	var rawState []byte
	e = tx.QueryRow(ctx, `SELECT a.assessment_id::text,a.assessment_version,a.status,a.expires_at,a.started_at,a.section_state,clock_timestamp(),v.assessment_kind,COALESCE(v.mock_presentation_mode,''),v.mock_strict_section_lock,v.require_answer_before_next FROM assessment_attempts a JOIN assessment_versions v ON v.assessment_id=a.assessment_id AND v.version=a.assessment_version WHERE a.id=$1::uuid AND a.student_id=$2::uuid FOR UPDATE OF a`, id, student).Scan(&aid, &ver, &status, &expires, &started, &rawState, &serverTime, &kind, &mode, &lock, &requireAnswer)
	if e != nil {
		return assessment.Attempt{}, mapError(e)
	}
	if status == assessment.AttemptExpired {
		return assessment.Attempt{}, assessment.ErrAttemptExpired
	}
	if status != assessment.AttemptInProgress {
		return assessment.Attempt{}, assessment.ErrAttemptSubmitted
	}
	if elapsed := max(0, int(serverTime.Sub(started).Seconds())); w.TimeSpentSeconds > elapsed {
		w.TimeSpentSeconds = elapsed
	}
	if expires != nil && !serverTime.Before(*expires) {
		_, _ = tx.Exec(ctx, `UPDATE assessment_attempts SET status='expired',updated_at=now() WHERE id=$1::uuid`, id)
		if e = tx.Commit(ctx); e != nil {
			return assessment.Attempt{}, e
		}
		return assessment.Attempt{}, assessment.ErrAttemptExpired
	}
	var qver int
	var questionSection string
	e = tx.QueryRow(ctx, `SELECT question_version,COALESCE(section_id::text,'') FROM assessment_version_questions WHERE assessment_id=$1::uuid AND assessment_version=$2 AND question_id=$3::uuid`, aid, ver, qid).Scan(&qver, &questionSection)
	if e != nil {
		return assessment.Attempt{}, mapError(e)
	}
	if kind == assessment.KindNormal && requireAnswer {
		blocked, err := hasUnansweredPreviousQuestion(ctx, tx, aid, ver, id, qid)
		if err != nil {
			return assessment.Attempt{}, err
		}
		if blocked {
			return assessment.Attempt{}, assessment.ErrConflict
		}
	}
	if strictMode(kind, mode, lock) {
		sections, err := loadAttemptSections(ctx, tx, aid, ver)
		if err != nil {
			return assessment.Attempt{}, err
		}
		stored, err := decodeStrictState(rawState)
		if err != nil {
			return assessment.Attempt{}, err
		}
		progress, err := resolveStrictSectionProgress(sections, stored, started, serverTime)
		if err != nil {
			return assessment.Attempt{}, err
		}
		if progress.Finished || questionSection == "" || questionSection != progress.CurrentSectionID {
			return assessment.Attempt{}, assessment.ErrConflict
		}
	}
	if w.SelectedOptionIndex != nil {
		var valid bool
		e = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM question_options WHERE question_id=$1::uuid AND version=$2 AND option_index=$3)`, qid, qver, *w.SelectedOptionIndex).Scan(&valid)
		if e != nil {
			return assessment.Attempt{}, e
		}
		if !valid {
			return assessment.Attempt{}, assessment.ErrInvalidAnswer
		}
	}
	_, e = tx.Exec(ctx, `INSERT INTO assessment_answers(attempt_id,assessment_id,assessment_version,question_id,question_version,selected_option_index,text_answer,time_spent_seconds,marked_for_review) VALUES($1::uuid,$2::uuid,$3,$4::uuid,$5,$6,NULLIF($7,''),$8,$9) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option_index=excluded.selected_option_index,text_answer=excluded.text_answer,time_spent_seconds=GREATEST(assessment_answers.time_spent_seconds,excluded.time_spent_seconds),marked_for_review=excluded.marked_for_review,last_saved_at=GREATEST(assessment_answers.last_saved_at,clock_timestamp()) WHERE assessment_answers.question_version=excluded.question_version`, id, aid, ver, qid, qver, w.SelectedOptionIndex, w.TextAnswer, w.TimeSpentSeconds, w.MarkedForReview)
	if e != nil {
		return assessment.Attempt{}, mapError(e)
	}
	if e = tx.Commit(ctx); e != nil {
		return assessment.Attempt{}, e
	}
	return r.GetAttempt(ctx, id)
}

func (r *Repository) Submit(ctx context.Context, student, id, submissionKey string) (assessment.Result, error) {
	isSelf, err := r.isSelfQuizAttempt(ctx, id)
	if err != nil {
		return assessment.Result{}, err
	}
	if isSelf {
		return r.submitSelfQuiz(ctx, student, id, submissionKey)
	}
	tx, e := r.db.Begin(ctx)
	if e != nil {
		return assessment.Result{}, e
	}
	defer tx.Rollback(ctx)
	var aid, existingKey string
	var ver int
	var status assessment.AttemptStatus
	var expires *time.Time
	var serverTime time.Time
	e = tx.QueryRow(ctx, `SELECT assessment_id::text,assessment_version,status,expires_at,COALESCE(submission_key,''),clock_timestamp() FROM assessment_attempts WHERE id=$1::uuid AND student_id=$2::uuid FOR UPDATE`, id, student).Scan(&aid, &ver, &status, &expires, &existingKey, &serverTime)
	if e != nil {
		return assessment.Result{}, mapError(e)
	}
	if status == assessment.AttemptSubmitted {
		if existingKey != submissionKey {
			return assessment.Result{}, assessment.ErrAttemptSubmitted
		}
		if e = tx.Commit(ctx); e != nil {
			return assessment.Result{}, e
		}
		return r.GetResult(ctx, id)
	}
	if status != assessment.AttemptInProgress && !(status == assessment.AttemptExpired && expires != nil && !serverTime.Before(*expires)) {
		return assessment.Result{}, assessment.ErrAttemptExpired
	}
	// A timeout closes answer editing, but must still finalize the answers that
	// were saved before the deadline. This also covers a reload after timeout.
	_, e = tx.Exec(ctx, `UPDATE assessment_answers aa SET is_correct=COALESCE(aa.selected_option_index=qv.correct_option_index,false),scored_at=now() FROM question_versions qv WHERE aa.attempt_id=$1::uuid AND qv.question_id=aa.question_id AND qv.version=aa.question_version`, id)
	if e != nil {
		return assessment.Result{}, e
	}
	var total, correct, wrong, unanswered, timeSpent int
	var score, pass float64
	e = tx.QueryRow(ctx, `WITH q AS(SELECT aq.question_id,aq.points,qv.correct_option_index FROM assessment_version_questions aq JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version WHERE aq.assessment_id=$1::uuid AND aq.assessment_version=$2), s AS(SELECT q.*,aa.selected_option_index,COALESCE(aa.time_spent_seconds,0) spent FROM q LEFT JOIN assessment_answers aa ON aa.attempt_id=$3::uuid AND aa.question_id=q.question_id) SELECT count(*)::int,count(*) FILTER(WHERE selected_option_index=correct_option_index)::int,count(*) FILTER(WHERE selected_option_index IS NOT NULL AND selected_option_index<>correct_option_index)::int,count(*) FILTER(WHERE selected_option_index IS NULL)::int,COALESCE(sum(spent),0)::int,CASE WHEN sum(points)>0 THEN 100.0*COALESCE(sum(points) FILTER(WHERE selected_option_index=correct_option_index),0)/sum(points) ELSE 0 END,(SELECT passing_score FROM assessment_versions WHERE assessment_id=$1::uuid AND version=$2) FROM s`, aid, ver, id).Scan(&total, &correct, &wrong, &unanswered, &timeSpent, &score, &pass)
	if e != nil {
		return assessment.Result{}, e
	}
	var result assessment.Result
	e = tx.QueryRow(ctx, `INSERT INTO assessment_results(attempt_id,assessment_id,assessment_version,student_id,score,total_questions,correct_answers,wrong_answers,unanswered,passed,time_spent_seconds) VALUES($1::uuid,$2::uuid,$3,$4::uuid,$5,$6,$7,$8,$9,$10,$11) RETURNING attempt_id::text,score,total_questions,correct_answers,wrong_answers,unanswered,passed,time_spent_seconds,finalized_at`, id, aid, ver, student, score, total, correct, wrong, unanswered, score >= pass, timeSpent).Scan(&result.AttemptID, &result.Score, &result.TotalQuestions, &result.CorrectAnswers, &result.WrongAnswers, &result.Unanswered, &result.Passed, &result.TimeSpentSeconds, &result.FinalizedAt)
	if e != nil {
		return assessment.Result{}, mapError(e)
	}
	_, e = tx.Exec(ctx, `UPDATE assessment_attempts SET status='submitted',submission_key=$2,submitted_at=now(),updated_at=now() WHERE id=$1::uuid`, id, submissionKey)
	if e != nil {
		return assessment.Result{}, mapError(e)
	}
	if e = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: student, Action: "assessment.attempt.submit", ResourceType: "assessment_attempt", ResourceID: id, Metadata: map[string]any{"score": score}}); e != nil {
		return assessment.Result{}, e
	}
	if e = tx.Commit(ctx); e != nil {
		return assessment.Result{}, e
	}
	return result, nil
}
func (r *Repository) GetResult(ctx context.Context, id string) (assessment.Result, error) {
	var x assessment.Result
	e := r.db.QueryRow(ctx, `SELECT attempt_id::text,score,total_questions,correct_answers,wrong_answers,unanswered,passed,time_spent_seconds,finalized_at FROM assessment_results WHERE attempt_id=$1::uuid`, id).Scan(&x.AttemptID, &x.Score, &x.TotalQuestions, &x.CorrectAnswers, &x.WrongAnswers, &x.Unanswered, &x.Passed, &x.TimeSpentSeconds, &x.FinalizedAt)
	if errors.Is(e, pgx.ErrNoRows) {
		return x, assessment.ErrResultUnavailable
	}
	return x, e
}
