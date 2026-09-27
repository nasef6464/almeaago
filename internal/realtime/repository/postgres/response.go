package postgres

import (
	"context"
	"fmt"
	"time"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	realtime "github.com/nasef6464/almeaago/internal/realtime/domain"
)

func (r *Repository) JoinSession(
	ctx context.Context,
	sessionID, studentID string,
) (realtime.Participant, error) {
	var out realtime.Participant
	err := r.db.QueryRow(ctx, `
		INSERT INTO classroom_participants(session_id,student_id)
		VALUES($1::uuid,$2::uuid)
		ON CONFLICT(session_id,student_id) DO UPDATE
		SET joined_at=classroom_participants.joined_at
		RETURNING session_id::text,student_id::text,joined_at,attendance_status,
		          COALESCE(attendance_overridden_by::text,''),attendance_overridden_at
	`, sessionID, studentID).Scan(
		&out.SessionID,
		&out.StudentID,
		&out.JoinedAt,
		&out.AttendanceStatus,
		&out.AttendanceOverriddenBy,
		&out.AttendanceOverriddenAt,
	)
	return out, mapError(err)
}

func (r *Repository) Participant(
	ctx context.Context,
	sessionID, studentID string,
) (realtime.Participant, error) {
	var out realtime.Participant
	err := r.db.QueryRow(ctx, `
		SELECT session_id::text,student_id::text,joined_at,attendance_status,
		       COALESCE(attendance_overridden_by::text,''),attendance_overridden_at
		FROM classroom_participants
		WHERE session_id=$1::uuid AND student_id=$2::uuid
	`, sessionID, studentID).Scan(
		&out.SessionID,
		&out.StudentID,
		&out.JoinedAt,
		&out.AttendanceStatus,
		&out.AttendanceOverriddenBy,
		&out.AttendanceOverriddenAt,
	)
	return out, mapError(err)
}

func (r *Repository) SetAttendance(
	ctx context.Context,
	sessionID, studentID, actorID string,
	status realtime.AttendanceStatus,
) (realtime.Participant, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return realtime.Participant{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	now := time.Now().UTC()

	var out realtime.Participant
	err = tx.QueryRow(ctx, `
		UPDATE classroom_participants
		SET attendance_status=$3,attendance_overridden_by=$4::uuid,attendance_overridden_at=$5
		WHERE session_id=$1::uuid AND student_id=$2::uuid
		RETURNING session_id::text,student_id::text,joined_at,attendance_status,
		          COALESCE(attendance_overridden_by::text,''),attendance_overridden_at
	`, sessionID, studentID, status, actorID, now).Scan(
		&out.SessionID,
		&out.StudentID,
		&out.JoinedAt,
		&out.AttendanceStatus,
		&out.AttendanceOverriddenBy,
		&out.AttendanceOverriddenAt,
	)
	if err != nil {
		return realtime.Participant{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "realtime.classroom.attendance.override",
		ResourceType: "classroom_session",
		ResourceID:   sessionID,
		Metadata: map[string]any{
			"studentId": studentID,
			"status":    status,
		},
	}); err != nil {
		return realtime.Participant{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return realtime.Participant{}, err
	}
	return out, nil
}

func (r *Repository) UpsertAnswer(
	ctx context.Context,
	sessionID, studentID string,
	ordinal, selectedOptionIndex int,
	isCorrect bool,
) (realtime.Response, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return realtime.Response{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var status realtime.SessionStatus
	var mode realtime.PublishedMode
	var activeBatchID string
	var activeOrdinal *int
	if err = tx.QueryRow(ctx, `
		SELECT status,published_mode,COALESCE(active_batch_id::text,''),active_question_ordinal
		FROM classroom_sessions
		WHERE id=$1::uuid
		FOR UPDATE
	`, sessionID).Scan(&status, &mode, &activeBatchID, &activeOrdinal); err != nil {
		return realtime.Response{}, mapError(err)
	}
	if status != realtime.SessionLive {
		return realtime.Response{}, realtime.ErrConflict
	}

	var batchID string
	var publishedAt, revealedAt, batchEndedAt *time.Time
	if err = tx.QueryRow(ctx, `
		SELECT q.batch_id::text,q.published_at,q.revealed_at,b.ended_at
		FROM classroom_questions q
		JOIN classroom_batches b ON b.id=q.batch_id AND b.session_id=q.session_id
		WHERE q.session_id=$1::uuid AND q.ordinal=$2
		FOR UPDATE OF q,b
	`, sessionID, ordinal).Scan(&batchID, &publishedAt, &revealedAt, &batchEndedAt); err != nil {
		return realtime.Response{}, mapError(err)
	}
	if publishedAt == nil || revealedAt != nil || batchEndedAt != nil {
		return realtime.Response{}, realtime.ErrConflict
	}
	if mode == realtime.PublishedSingle {
		if activeOrdinal == nil || *activeOrdinal != ordinal {
			return realtime.Response{}, realtime.ErrConflict
		}
	} else if activeBatchID != batchID {
		return realtime.Response{}, realtime.ErrConflict
	}

	var participantExists bool
	if err = tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM classroom_participants
			WHERE session_id=$1::uuid AND student_id=$2::uuid
		)
	`, sessionID, studentID).Scan(&participantExists); err != nil {
		return realtime.Response{}, err
	}
	if !participantExists {
		return realtime.Response{}, realtime.ErrConflict
	}

	now := time.Now().UTC()
	var out realtime.Response
	err = tx.QueryRow(ctx, `
		INSERT INTO classroom_responses(
			session_id,question_ordinal,student_id,selected_option_index,is_correct,submitted_at,updated_at
		)
		VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,$6)
		ON CONFLICT(session_id,question_ordinal,student_id) DO UPDATE
		SET selected_option_index=EXCLUDED.selected_option_index,
		    is_correct=EXCLUDED.is_correct,
		    submitted_at=EXCLUDED.submitted_at,
		    updated_at=EXCLUDED.updated_at
		RETURNING session_id::text,question_ordinal,student_id::text,
		          selected_option_index,is_correct,submitted_at,updated_at
	`, sessionID, ordinal, studentID, selectedOptionIndex, isCorrect, now).Scan(
		&out.SessionID,
		&out.QuestionOrdinal,
		&out.StudentID,
		&out.SelectedOptionIndex,
		&out.IsCorrect,
		&out.SubmittedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		return realtime.Response{}, mapError(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return realtime.Response{}, err
	}
	return out, nil
}

func (r *Repository) StudentResponses(
	ctx context.Context,
	sessionID, studentID string,
) (map[int]realtime.Response, error) {
	rows, err := r.db.Query(ctx, `
		SELECT session_id::text,question_ordinal,student_id::text,
		       selected_option_index,is_correct,submitted_at,updated_at
		FROM classroom_responses
		WHERE session_id=$1::uuid AND student_id=$2::uuid
	`, sessionID, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[int]realtime.Response{}
	for rows.Next() {
		var item realtime.Response
		if err = rows.Scan(
			&item.SessionID,
			&item.QuestionOrdinal,
			&item.StudentID,
			&item.SelectedOptionIndex,
			&item.IsCorrect,
			&item.SubmittedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out[item.QuestionOrdinal] = item
	}
	return out, rows.Err()
}

func (r *Repository) Aggregate(
	ctx context.Context,
	sessionID string,
) (realtime.Aggregate, error) {
	session, err := r.GetSession(ctx, sessionID)
	if err != nil {
		return realtime.Aggregate{}, err
	}
	var joined int
	if err = r.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM classroom_participants
		WHERE session_id=$1::uuid
	`, sessionID).Scan(&joined); err != nil {
		return realtime.Aggregate{}, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT
			q.ordinal,
			q.question_id::text,
			count(r.student_id)::int,
			count(r.student_id) FILTER (WHERE r.is_correct)::int
		FROM classroom_questions q
		LEFT JOIN classroom_responses r
		  ON r.session_id=q.session_id AND r.question_ordinal=q.ordinal
		WHERE q.session_id=$1::uuid
		GROUP BY q.ordinal,q.question_id
		ORDER BY q.ordinal
	`, sessionID)
	if err != nil {
		return realtime.Aggregate{}, err
	}
	defer rows.Close()

	out := realtime.Aggregate{
		SessionID:             session.ID,
		Status:                session.Status,
		ActiveBatchID:         session.ActiveBatchID,
		ActiveQuestionOrdinal: session.ActiveQuestionOrdinal,
		JoinedCount:           joined,
		Questions:             []realtime.QuestionAggregate{},
	}
	byOrdinal := map[int]int{}
	for rows.Next() {
		var item realtime.QuestionAggregate
		item.Distribution = map[string]int{}
		if err = rows.Scan(&item.Ordinal, &item.QuestionID, &item.ResponseCount, &item.CorrectCount); err != nil {
			return realtime.Aggregate{}, err
		}
		byOrdinal[item.Ordinal] = len(out.Questions)
		out.Questions = append(out.Questions, item)
	}
	if err = rows.Err(); err != nil {
		return realtime.Aggregate{}, err
	}

	distributionRows, err := r.db.Query(ctx, `
		SELECT question_ordinal,selected_option_index,count(*)::int
		FROM classroom_responses
		WHERE session_id=$1::uuid
		GROUP BY question_ordinal,selected_option_index
		ORDER BY question_ordinal,selected_option_index
	`, sessionID)
	if err != nil {
		return realtime.Aggregate{}, err
	}
	defer distributionRows.Close()
	for distributionRows.Next() {
		var ordinal, optionIndex, count int
		if err = distributionRows.Scan(&ordinal, &optionIndex, &count); err != nil {
			return realtime.Aggregate{}, err
		}
		if index, ok := byOrdinal[ordinal]; ok {
			out.Questions[index].Distribution[fmt.Sprint(optionIndex)] = count
		}
	}
	if err = distributionRows.Err(); err != nil {
		return realtime.Aggregate{}, err
	}
	return out, nil
}
