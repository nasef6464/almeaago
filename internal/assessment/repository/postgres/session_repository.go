package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) CreateSession(ctx context.Context, actor string, roles []identity.Role, w assessment.SessionWrite, code string) (assessment.Session, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Session{}, err
	}
	defer tx.Rollback(ctx)

	if w.SchoolID != "" {
		ok, scopeErr := r.canManageAssignment(ctx, tx, actor, roles, w.SchoolID, w.AssessmentID)
		if scopeErr != nil {
			return assessment.Session{}, scopeErr
		}
		if !ok {
			return assessment.Session{}, assessment.ErrConflict
		}
	}
	if w.ClassID != "" {
		var ok bool
		if err = tx.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM classes
			 WHERE id=$1::uuid AND school_id=$2::uuid AND status='active'
			)
		`, w.ClassID, w.SchoolID).Scan(&ok); err != nil {
			return assessment.Session{}, err
		}
		if !ok {
			return assessment.Session{}, assessment.ErrConflict
		}
	}

	var version int
	err = tx.QueryRow(ctx, `
		SELECT published_version
		  FROM assessments
		 WHERE id=$1::uuid
		   AND workflow_status='approved'
		   AND is_published=true
		   AND is_visible=true
		 FOR UPDATE
	`, w.AssessmentID).Scan(&version)
	if err != nil {
		return assessment.Session{}, mapError(err)
	}

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO assessment_sessions(
			assessment_id,assessment_version,channel,session_code,status,school_id,class_id,
			opens_at,closes_at,max_submissions,created_by
		) VALUES(
			$1::uuid,$2,$3,$4,'scheduled',NULLIF($5,'')::uuid,NULLIF($6,'')::uuid,
			$7,$8,$9,$10::uuid
		)
		RETURNING id::text
	`, w.AssessmentID, version, string(w.Channel), code, w.SchoolID, w.ClassID, w.OpensAt, w.ClosesAt, w.MaxSubmissions, actor).Scan(&id)
	if err != nil {
		return assessment.Session{}, mapError(err)
	}

	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actor,
		Action:       "assessment.session.create",
		ResourceType: "assessment_session",
		ResourceID:   id,
		Metadata: map[string]any{
			"assessmentId": w.AssessmentID,
			"version":      version,
			"channel":      w.Channel,
		},
	}); err != nil {
		return assessment.Session{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Session{}, err
	}
	return r.GetSession(ctx, id)
}

func scanSession(row pgx.Row) (assessment.Session, error) {
	var s assessment.Session
	err := row.Scan(
		&s.ID, &s.AssessmentID, &s.AssessmentVersion, &s.Title, &s.Channel, &s.SessionCode,
		&s.Status, &s.SchoolID, &s.ClassID, &s.OpensAt, &s.ClosesAt, &s.MaxSubmissions,
		&s.CreatedAt, &s.UpdatedAt,
	)
	return s, err
}

func (r *Repository) GetSession(ctx context.Context, id string) (assessment.Session, error) {
	row := r.db.QueryRow(ctx, `
		SELECT s.id::text,s.assessment_id::text,s.assessment_version,v.title,s.channel,s.session_code,s.status,
		       COALESCE(s.school_id::text,''),COALESCE(s.class_id::text,''),s.opens_at,s.closes_at,s.max_submissions,
		       s.created_at,s.updated_at
		  FROM assessment_sessions s
		  JOIN assessment_versions v ON v.assessment_id=s.assessment_id AND v.version=s.assessment_version
		 WHERE s.id=$1::uuid
	`, id)
	out, err := scanSession(row)
	if err != nil {
		return out, mapError(err)
	}
	return out, nil
}

func (r *Repository) ListSessions(ctx context.Context, assessmentID, actor string, roles []identity.Role, page, limit int) (assessment.SessionPage, error) {
	args := []any{assessmentID, limit + 1, (page - 1) * limit}
	scope := ""
	if !has(roles, identity.RoleAdmin) {
		args = append(args, actor)
		scope = ` AND (
			s.created_by=$4::uuid
			OR EXISTS(
				SELECT 1 FROM assessments a
				 WHERE a.id=s.assessment_id
				   AND (a.owner_user_id=$4::uuid OR a.assigned_teacher_id=$4::uuid)
			)
		)`
	}
	rows, err := r.db.Query(ctx, `
		SELECT s.id::text,s.assessment_id::text,s.assessment_version,v.title,s.channel,s.session_code,s.status,
		       COALESCE(s.school_id::text,''),COALESCE(s.class_id::text,''),s.opens_at,s.closes_at,s.max_submissions,
		       s.created_at,s.updated_at
		  FROM assessment_sessions s
		  JOIN assessment_versions v ON v.assessment_id=s.assessment_id AND v.version=s.assessment_version
		 WHERE s.assessment_id=$1::uuid`+scope+`
		 ORDER BY s.created_at DESC,s.id DESC
		 LIMIT $2 OFFSET $3
	`, args...)
	if err != nil {
		return assessment.SessionPage{}, err
	}
	defer rows.Close()

	out := assessment.SessionPage{Page: page, Limit: limit}
	for rows.Next() {
		var s assessment.Session
		if err = rows.Scan(
			&s.ID, &s.AssessmentID, &s.AssessmentVersion, &s.Title, &s.Channel, &s.SessionCode,
			&s.Status, &s.SchoolID, &s.ClassID, &s.OpensAt, &s.ClosesAt, &s.MaxSubmissions,
			&s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return out, err
		}
		out.Items = append(out.Items, s)
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

func (r *Repository) SetSessionStatus(ctx context.Context, actor string, roles []identity.Role, id string, status assessment.SessionStatus) (assessment.Session, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Session{}, err
	}
	defer tx.Rollback(ctx)

	var assessmentID, schoolID string
	err = tx.QueryRow(ctx, `
		SELECT assessment_id::text,COALESCE(school_id::text,'')
		  FROM assessment_sessions
		 WHERE id=$1::uuid
		 FOR UPDATE
	`, id).Scan(&assessmentID, &schoolID)
	if err != nil {
		return assessment.Session{}, mapError(err)
	}
	if schoolID != "" {
		ok, scopeErr := r.canManageAssignment(ctx, tx, actor, roles, schoolID, assessmentID)
		if scopeErr != nil {
			return assessment.Session{}, scopeErr
		}
		if !ok {
			return assessment.Session{}, assessment.ErrConflict
		}
	}
	tag, err := tx.Exec(ctx, `
		UPDATE assessment_sessions
		   SET status=$2,updated_at=now()
		 WHERE id=$1::uuid
	`, id, string(status))
	if err != nil {
		return assessment.Session{}, mapError(err)
	}
	if tag.RowsAffected() != 1 {
		return assessment.Session{}, assessment.ErrNotFound
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actor,
		Action:       "assessment.session.status",
		ResourceType: "assessment_session",
		ResourceID:   id,
		Metadata:     map[string]any{"status": status},
	}); err != nil {
		return assessment.Session{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Session{}, err
	}
	return r.GetSession(ctx, id)
}

func publicHash(participantKey string) []byte {
	sum := sha256.Sum256([]byte(participantKey))
	return sum[:]
}

func (r *Repository) StartPublic(ctx context.Context, code, participantKey, startKey string) (assessment.PublicAttempt, error) {
	hash := publicHash(participantKey)
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.PublicAttempt{}, err
	}
	defer tx.Rollback(ctx)

	var existingID string
	var existingHash []byte
	err = tx.QueryRow(ctx, `
		SELECT id::text,participant_key_hash
		  FROM assessment_public_attempts
		 WHERE start_key=$1
	`, startKey).Scan(&existingID, &existingHash)
	if err == nil {
		if string(existingHash) != string(hash) {
			return assessment.PublicAttempt{}, assessment.ErrConflict
		}
		if err = tx.Commit(ctx); err != nil {
			return assessment.PublicAttempt{}, err
		}
		return r.getPublicAttempt(ctx, existingID, hash)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return assessment.PublicAttempt{}, err
	}

	var sessionID, assessmentID string
	var version, maxAttempts int
	var timeLimit *int
	var closesAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT s.id::text,s.assessment_id::text,s.assessment_version,v.max_attempts,v.time_limit_seconds,s.closes_at
		  FROM assessment_sessions s
		  JOIN assessments a ON a.id=s.assessment_id
		  JOIN assessment_versions v ON v.assessment_id=s.assessment_id AND v.version=s.assessment_version
		 WHERE lower(s.session_code)=lower($1)
		   AND s.channel IN ('public','barcode')
		   AND s.status='active'
		   AND (s.opens_at IS NULL OR s.opens_at<=now())
		   AND (s.closes_at IS NULL OR s.closes_at>now())
		   AND a.workflow_status='approved'
		   AND a.is_published=true
		   AND a.is_visible=true
	`, code).Scan(&sessionID, &assessmentID, &version, &maxAttempts, &timeLimit, &closesAt)
	if err != nil {
		return assessment.PublicAttempt{}, mapError(err)
	}

	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, sessionID+":"+hex.EncodeToString(hash)); err != nil {
		return assessment.PublicAttempt{}, err
	}

	var invalid bool
	if err = tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			  FROM assessment_version_questions aq
			  JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version
			 WHERE aq.assessment_id=$1::uuid
			   AND aq.assessment_version=$2
			   AND qv.correct_option_index IS NULL
		) OR NOT EXISTS(
			SELECT 1 FROM assessment_version_questions
			 WHERE assessment_id=$1::uuid AND assessment_version=$2
		)
	`, assessmentID, version).Scan(&invalid); err != nil {
		return assessment.PublicAttempt{}, err
	}
	if invalid {
		return assessment.PublicAttempt{}, assessment.ErrConflict
	}

	var used int
	if err = tx.QueryRow(ctx, `
		SELECT count(*)::int
		  FROM assessment_public_attempts
		 WHERE session_id=$1::uuid AND participant_key_hash=$2
	`, sessionID, hash).Scan(&used); err != nil {
		return assessment.PublicAttempt{}, err
	}
	if used >= maxAttempts {
		return assessment.PublicAttempt{}, assessment.ErrConflict
	}

	var id string
	var expiresAt *time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO assessment_public_attempts(
			session_id,assessment_id,assessment_version,participant_key_hash,attempt_number,start_key,expires_at
		) VALUES(
			$1::uuid,$2::uuid,$3,$4,$5,$6,
			CASE
				WHEN $7::int IS NULL THEN $8::timestamptz
				WHEN $8::timestamptz IS NULL THEN now()+make_interval(secs=>$7)
				ELSE LEAST(now()+make_interval(secs=>$7),$8::timestamptz)
			END
		)
		RETURNING id::text,expires_at
	`, sessionID, assessmentID, version, hash, used+1, startKey, timeLimit, closesAt).Scan(&id, &expiresAt)
	if err != nil {
		return assessment.PublicAttempt{}, mapError(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.PublicAttempt{}, err
	}
	return r.getPublicAttempt(ctx, id, hash)
}

func (r *Repository) getPublicAttempt(ctx context.Context, id string, hash []byte) (assessment.PublicAttempt, error) {
	var out assessment.PublicAttempt
	var randomQuestions, randomOptions bool
	err := r.db.QueryRow(ctx, `
		SELECT pa.id::text,pa.session_id::text,s.session_code,pa.assessment_id::text,pa.assessment_version,
		       v.title,pa.attempt_number,pa.status,pa.started_at,pa.expires_at,
		       v.show_progress_bar,v.require_answer_before_next,v.option_layout,
		       v.randomize_questions,v.randomize_options
		  FROM assessment_public_attempts pa
		  JOIN assessment_sessions s ON s.id=pa.session_id
		  JOIN assessment_versions v ON v.assessment_id=pa.assessment_id AND v.version=pa.assessment_version
		 WHERE pa.id=$1::uuid AND pa.participant_key_hash=$2
	`, id, hash).Scan(
		&out.ID, &out.SessionID, &out.SessionCode, &out.AssessmentID, &out.AssessmentVersion,
		&out.Title, &out.AttemptNumber, &out.Status, &out.StartedAt, &out.ExpiresAt,
		&out.ShowProgressBar, &out.RequireAnswerBeforeNext, &out.OptionLayout,
		&randomQuestions, &randomOptions,
	)
	if err != nil {
		return out, mapError(err)
	}
	if out.Status == assessment.AttemptInProgress && out.ExpiresAt != nil && time.Now().After(*out.ExpiresAt) {
		out.Status = assessment.AttemptExpired
	}

	rows, err := r.db.Query(ctx, `
		SELECT aq.question_id::text,aq.question_version,COALESCE(aq.section_id::text,''),aq.sort_order,aq.points,
		       qv.question_type,qv.text_content,COALESCE(qv.image_asset_id::text,''),qv.image_alt,
		       qv.options_embedded_in_image,COALESCE(qv.video_url,''),COALESCE(qv.difficulty,'')
		  FROM assessment_version_questions aq
		  JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version
		 WHERE aq.assessment_id=$1::uuid AND aq.assessment_version=$2
		 ORDER BY
		   CASE WHEN $3 THEN md5($4||aq.question_id::text) ELSE lpad(aq.sort_order::text,12,'0') END,
		   aq.question_id
	`, out.AssessmentID, out.AssessmentVersion, randomQuestions, id)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	byID := make(map[string]int)
	for rows.Next() {
		var q assessment.LearnerQuestion
		if err = rows.Scan(
			&q.ID, &q.Version, &q.SectionID, &q.SortOrder, &q.Points, &q.Type, &q.Text,
			&q.ImageAssetID, &q.ImageAlt, &q.OptionsEmbeddedInImage, &q.VideoURL, &q.Difficulty,
		); err != nil {
			return out, err
		}
		byID[q.ID] = len(out.Questions)
		out.Questions = append(out.Questions, q)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}

	optionRows, err := r.db.Query(ctx, `
		SELECT qo.question_id::text,qo.option_index,qo.option_text,COALESCE(qo.asset_id::text,'')
		  FROM question_options qo
		  JOIN assessment_version_questions aq
		    ON aq.question_id=qo.question_id AND aq.question_version=qo.version
		 WHERE aq.assessment_id=$1::uuid AND aq.assessment_version=$2
		 ORDER BY qo.question_id,
		   CASE WHEN $3 THEN md5($4||qo.question_id::text||qo.option_index::text) ELSE lpad(qo.option_index::text,12,'0') END
	`, out.AssessmentID, out.AssessmentVersion, randomOptions, id)
	if err != nil {
		return out, err
	}
	defer optionRows.Close()
	for optionRows.Next() {
		var qid string
		var option assessment.LearnerOption
		if err = optionRows.Scan(&qid, &option.Index, &option.Text, &option.AssetID); err != nil {
			return out, err
		}
		if idx, ok := byID[qid]; ok {
			out.Questions[idx].Options = append(out.Questions[idx].Options, option)
		}
	}
	return out, optionRows.Err()
}

func (r *Repository) SubmitPublic(ctx context.Context, code string, in assessment.PublicSubmitInput) (assessment.PublicSubmission, error) {
	hash := publicHash(in.ParticipantKey)
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.PublicSubmission{}, err
	}
	defer tx.Rollback(ctx)

	var assessmentID, sessionID, existingKey string
	var version int
	var status assessment.AttemptStatus
	var expiresAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT pa.assessment_id::text,pa.assessment_version,pa.session_id::text,pa.status,pa.expires_at,COALESCE(pa.submission_key,'')
		  FROM assessment_public_attempts pa
		  JOIN assessment_sessions s ON s.id=pa.session_id
		 WHERE pa.id=$1::uuid
		   AND pa.participant_key_hash=$2
		   AND lower(s.session_code)=lower($3)
		 FOR UPDATE OF pa
	`, in.PublicAttemptID, hash, code).Scan(&assessmentID, &version, &sessionID, &status, &expiresAt, &existingKey)
	if err != nil {
		return assessment.PublicSubmission{}, mapError(err)
	}
	if status == assessment.AttemptSubmitted {
		if existingKey != in.SubmissionKey {
			return assessment.PublicSubmission{}, assessment.ErrAttemptSubmitted
		}
		if err = tx.Commit(ctx); err != nil {
			return assessment.PublicSubmission{}, err
		}
		return r.getPublicSubmission(ctx, in.PublicAttemptID)
	}
	if status != assessment.AttemptInProgress {
		return assessment.PublicSubmission{}, assessment.ErrAttemptExpired
	}
	if expiresAt != nil && time.Now().After(*expiresAt) {
		if _, err = tx.Exec(ctx, `UPDATE assessment_public_attempts SET status='expired',updated_at=now() WHERE id=$1::uuid`, in.PublicAttemptID); err != nil {
			return assessment.PublicSubmission{}, err
		}
		if err = tx.Commit(ctx); err != nil {
			return assessment.PublicSubmission{}, err
		}
		return assessment.PublicSubmission{}, assessment.ErrAttemptExpired
	}

	var maxSubmissions *int
	var showResults bool
	var requireAll bool
	err = tx.QueryRow(ctx, `
		SELECT s.max_submissions,v.show_results_report,v.require_answer_before_next
		  FROM assessment_sessions s
		  JOIN assessment_versions v ON v.assessment_id=s.assessment_id AND v.version=s.assessment_version
		 WHERE s.id=$1::uuid
		   AND s.status='active'
		   AND (s.opens_at IS NULL OR s.opens_at<=now())
		   AND (s.closes_at IS NULL OR s.closes_at>now())
		 FOR UPDATE OF s
	`, sessionID).Scan(&maxSubmissions, &showResults, &requireAll)
	if err != nil {
		return assessment.PublicSubmission{}, mapError(err)
	}
	if maxSubmissions != nil {
		var used int
		if err = tx.QueryRow(ctx, `SELECT count(*)::int FROM assessment_public_results r JOIN assessment_public_attempts a ON a.id=r.public_attempt_id WHERE a.session_id=$1::uuid`, sessionID).Scan(&used); err != nil {
			return assessment.PublicSubmission{}, err
		}
		if used >= *maxSubmissions {
			return assessment.PublicSubmission{}, assessment.ErrConflict
		}
	}

	raw, err := json.Marshal(in.Answers)
	if err != nil {
		return assessment.PublicSubmission{}, err
	}
	tag, err := tx.Exec(ctx, `
		WITH incoming AS (
			SELECT "questionId" AS question_id,"selectedOptionIndex" AS selected_option_index
			  FROM jsonb_to_recordset($4::jsonb)
			       AS x("questionId" text,"selectedOptionIndex" integer)
		)
		INSERT INTO assessment_public_answers(
			public_attempt_id,assessment_id,assessment_version,question_id,question_version,
			selected_option_index,is_correct
		)
		SELECT $1::uuid,$2::uuid,$3,aq.question_id,aq.question_version,i.selected_option_index,
		       (i.selected_option_index IS NOT NULL AND i.selected_option_index=qv.correct_option_index)
		  FROM incoming i
		  JOIN assessment_version_questions aq
		    ON aq.assessment_id=$2::uuid
		   AND aq.assessment_version=$3
		   AND aq.question_id=i.question_id::uuid
		  JOIN question_versions qv
		    ON qv.question_id=aq.question_id AND qv.version=aq.question_version
		  LEFT JOIN question_options qo
		    ON qo.question_id=aq.question_id
		   AND qo.version=aq.question_version
		   AND qo.option_index=i.selected_option_index
		 WHERE i.selected_option_index IS NULL OR qo.option_index IS NOT NULL
	`, in.PublicAttemptID, assessmentID, version, string(raw))
	if err != nil {
		return assessment.PublicSubmission{}, mapError(err)
	}
	if tag.RowsAffected() != int64(len(in.Answers)) {
		return assessment.PublicSubmission{}, assessment.ErrConflict
	}

	var total, answered int
	if err = tx.QueryRow(ctx, `
		SELECT count(*)::int,
		       count(*) FILTER (WHERE a.selected_option_index IS NOT NULL)::int
		  FROM assessment_version_questions q
		  LEFT JOIN assessment_public_answers a
		    ON a.public_attempt_id=$3::uuid AND a.question_id=q.question_id
		 WHERE q.assessment_id=$1::uuid AND q.assessment_version=$2
	`, assessmentID, version, in.PublicAttemptID).Scan(&total, &answered); err != nil {
		return assessment.PublicSubmission{}, err
	}
	if requireAll && answered != total {
		return assessment.PublicSubmission{}, assessment.ErrConflict
	}

	var result assessment.Result
	var passScore float64
	err = tx.QueryRow(ctx, `
		WITH q AS (
			SELECT aq.question_id,aq.points,qv.correct_option_index
			  FROM assessment_version_questions aq
			  JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version
			 WHERE aq.assessment_id=$1::uuid AND aq.assessment_version=$2
		), s AS (
			SELECT q.*,a.selected_option_index
			  FROM q
			  LEFT JOIN assessment_public_answers a
			    ON a.public_attempt_id=$3::uuid AND a.question_id=q.question_id
		)
		SELECT count(*)::int,
		       count(*) FILTER (WHERE selected_option_index=correct_option_index)::int,
		       count(*) FILTER (WHERE selected_option_index IS NOT NULL AND selected_option_index<>correct_option_index)::int,
		       count(*) FILTER (WHERE selected_option_index IS NULL)::int,
		       CASE WHEN sum(points)>0
		            THEN 100.0*sum(points) FILTER (WHERE selected_option_index=correct_option_index)/sum(points)
		            ELSE 0 END,
		       (SELECT passing_score FROM assessment_versions WHERE assessment_id=$1::uuid AND version=$2)
		  FROM s
	`, assessmentID, version, in.PublicAttemptID).Scan(
		&result.TotalQuestions, &result.CorrectAnswers, &result.WrongAnswers, &result.Unanswered,
		&result.Score, &passScore,
	)
	if err != nil {
		return assessment.PublicSubmission{}, err
	}
	result.AttemptID = in.PublicAttemptID
	result.Passed = result.Score >= passScore
	result.TimeSpentSeconds = in.TimeSpentSeconds

	err = tx.QueryRow(ctx, `
		INSERT INTO assessment_public_results(
			public_attempt_id,assessment_id,assessment_version,score,total_questions,correct_answers,
			wrong_answers,unanswered,passed,time_spent_seconds
		) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING finalized_at
	`, in.PublicAttemptID, assessmentID, version, result.Score, result.TotalQuestions, result.CorrectAnswers,
		result.WrongAnswers, result.Unanswered, result.Passed, result.TimeSpentSeconds).Scan(&result.FinalizedAt)
	if err != nil {
		return assessment.PublicSubmission{}, mapError(err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE assessment_public_attempts
		   SET status='submitted',submission_key=$2,participant_name=$3,school_name=$4,classroom_name=$5,
		       contact=$6,submitted_at=now(),updated_at=now()
		 WHERE id=$1::uuid
	`, in.PublicAttemptID, in.SubmissionKey, in.ParticipantName, in.SchoolName, in.ClassroomName, in.Contact)
	if err != nil {
		return assessment.PublicSubmission{}, mapError(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.PublicSubmission{}, err
	}
	if !showResults {
		return assessment.PublicSubmission{ResultVisible: false}, nil
	}
	return assessment.PublicSubmission{ResultVisible: true, Result: &result}, nil
}

func (r *Repository) getPublicSubmission(ctx context.Context, id string) (assessment.PublicSubmission, error) {
	var out assessment.Result
	var show bool
	err := r.db.QueryRow(ctx, `
		SELECT r.public_attempt_id::text,r.score,r.total_questions,r.correct_answers,r.wrong_answers,
		       r.unanswered,r.passed,r.time_spent_seconds,r.finalized_at,v.show_results_report
		  FROM assessment_public_results r
		  JOIN assessment_versions v ON v.assessment_id=r.assessment_id AND v.version=r.assessment_version
		 WHERE r.public_attempt_id=$1::uuid
	`, id).Scan(
		&out.AttemptID, &out.Score, &out.TotalQuestions, &out.CorrectAnswers, &out.WrongAnswers,
		&out.Unanswered, &out.Passed, &out.TimeSpentSeconds, &out.FinalizedAt, &show,
	)
	if err != nil {
		return assessment.PublicSubmission{}, mapError(err)
	}
	if !show {
		return assessment.PublicSubmission{ResultVisible: false}, nil
	}
	return assessment.PublicSubmission{ResultVisible: true, Result: &out}, nil
}

func (r *Repository) LiveByCode(ctx context.Context, student, code string) (assessment.LiveJoin, error) {
	var out assessment.LiveJoin
	err := r.db.QueryRow(ctx, `
		SELECT s.id::text,s.assessment_id::text,s.assessment_version,v.title,s.session_code,s.opens_at,s.closes_at,
		       (SELECT count(*)::int FROM assessment_attempts x WHERE x.session_id=s.id AND x.student_id=$1::uuid),
		       v.max_attempts
		  FROM assessment_sessions s
		  JOIN assessments a ON a.id=s.assessment_id
		  JOIN assessment_versions v ON v.assessment_id=s.assessment_id AND v.version=s.assessment_version
		 WHERE lower(s.session_code)=lower($2)
		   AND s.channel='live'
		   AND s.status='active'
		   AND (s.opens_at IS NULL OR s.opens_at<=now())
		   AND (s.closes_at IS NULL OR s.closes_at>now())
		   AND a.workflow_status='approved'
		   AND a.is_published=true
		   AND a.is_visible=true
		   AND (
			 s.school_id IS NULL
			 OR EXISTS(
				SELECT 1 FROM school_memberships sm
				 WHERE sm.school_id=s.school_id AND sm.user_id=$1::uuid AND sm.status='active'
			 )
		   )
		   AND (
			 s.class_id IS NULL
			 OR EXISTS(
				SELECT 1 FROM class_memberships cm
				 WHERE cm.class_id=s.class_id AND cm.user_id=$1::uuid AND cm.status='active'
			 )
		   )
	`, student, code).Scan(
		&out.SessionID, &out.AssessmentID, &out.AssessmentVersion, &out.Title, &out.SessionCode,
		&out.OpensAt, &out.ClosesAt, &out.AttemptCount, &out.MaxAttempts,
	)
	if err != nil {
		return out, mapError(err)
	}
	out.CanStart = out.AttemptCount < out.MaxAttempts
	return out, nil
}

func (r *Repository) StartLive(ctx context.Context, student, sessionID, startKey string) (assessment.Attempt, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Attempt{}, err
	}
	defer tx.Rollback(ctx)

	var existingID, existingStudent, existingSession string
	err = tx.QueryRow(ctx, `
		SELECT id::text,student_id::text,COALESCE(session_id::text,'')
		  FROM assessment_attempts
		 WHERE start_key=$1
	`, startKey).Scan(&existingID, &existingStudent, &existingSession)
	if err == nil {
		if existingStudent != student || existingSession != sessionID {
			return assessment.Attempt{}, assessment.ErrConflict
		}
		if err = tx.Commit(ctx); err != nil {
			return assessment.Attempt{}, err
		}
		return r.GetAttempt(ctx, existingID)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return assessment.Attempt{}, err
	}

	var assessmentID string
	var version, maxAttempts int
	var timeLimit *int
	var closesAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT s.assessment_id::text,s.assessment_version,v.max_attempts,v.time_limit_seconds,s.closes_at
		  FROM assessment_sessions s
		  JOIN assessments a ON a.id=s.assessment_id
		  JOIN assessment_versions v ON v.assessment_id=s.assessment_id AND v.version=s.assessment_version
		 WHERE s.id=$1::uuid
		   AND s.channel='live'
		   AND s.status='active'
		   AND (s.opens_at IS NULL OR s.opens_at<=now())
		   AND (s.closes_at IS NULL OR s.closes_at>now())
		   AND a.workflow_status='approved'
		   AND a.is_published=true
		   AND a.is_visible=true
		   AND (
			 s.school_id IS NULL
			 OR EXISTS(SELECT 1 FROM school_memberships sm WHERE sm.school_id=s.school_id AND sm.user_id=$2::uuid AND sm.status='active')
		   )
		   AND (
			 s.class_id IS NULL
			 OR EXISTS(SELECT 1 FROM class_memberships cm WHERE cm.class_id=s.class_id AND cm.user_id=$2::uuid AND cm.status='active')
		   )
		 FOR UPDATE OF s
	`, sessionID, student).Scan(&assessmentID, &version, &maxAttempts, &timeLimit, &closesAt)
	if err != nil {
		return assessment.Attempt{}, mapError(err)
	}

	var invalid bool
	if err = tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM assessment_version_questions aq
			JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version
			WHERE aq.assessment_id=$1::uuid AND aq.assessment_version=$2 AND qv.correct_option_index IS NULL
		) OR NOT EXISTS(
			SELECT 1 FROM assessment_version_questions WHERE assessment_id=$1::uuid AND assessment_version=$2
		)
	`, assessmentID, version).Scan(&invalid); err != nil {
		return assessment.Attempt{}, err
	}
	if invalid {
		return assessment.Attempt{}, assessment.ErrConflict
	}

	var used int
	if err = tx.QueryRow(ctx, `
		SELECT count(*)::int FROM assessment_attempts
		 WHERE session_id=$1::uuid AND student_id=$2::uuid
	`, sessionID, student).Scan(&used); err != nil {
		return assessment.Attempt{}, err
	}
	if used >= maxAttempts {
		return assessment.Attempt{}, assessment.ErrConflict
	}

	var id string
	var expiresAt *time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO assessment_attempts(
			assessment_id,assessment_version,student_id,session_id,attempt_number,start_key,expires_at,source_context
		) VALUES(
			$1::uuid,$2,$3::uuid,$4::uuid,$5,$6,
			CASE
				WHEN $7::int IS NULL THEN $8::timestamptz
				WHEN $8::timestamptz IS NULL THEN now()+make_interval(secs=>$7)
				ELSE LEAST(now()+make_interval(secs=>$7),$8::timestamptz)
			END,
			jsonb_build_object('type','session','channel','live','sessionId',$4::text)
		)
		RETURNING id::text,expires_at
	`, assessmentID, version, student, sessionID, used+1, startKey, timeLimit, closesAt).Scan(&id, &expiresAt)
	if err != nil {
		return assessment.Attempt{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  student,
		Action:       "assessment.session.attempt.start",
		ResourceType: "assessment_attempt",
		ResourceID:   id,
		Metadata: map[string]any{
			"sessionId":    sessionID,
			"assessmentId": assessmentID,
			"version":      version,
		},
	}); err != nil {
		return assessment.Attempt{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Attempt{}, err
	}
	return r.GetAttempt(ctx, id)
}
