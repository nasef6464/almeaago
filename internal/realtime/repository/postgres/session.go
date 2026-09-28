package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	realtime "github.com/nasef6464/almeaago/internal/realtime/domain"
)

func (r *Repository) CreateSession(
	ctx context.Context,
	record realtime.CreateRecord,
) (realtime.Session, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return realtime.Session{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var sessionID string
	err = tx.QueryRow(ctx, `
		INSERT INTO classroom_sessions(
			school_id,class_id,subject_id,teacher_id,status,day,period,published_mode,
			pin_hash,pin_expires_at,created_by
		)
		VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,'draft',$5,$6,$7,$8,$9,$10::uuid)
		RETURNING id::text
	`,
		record.SchoolID,
		record.ClassID,
		record.SubjectID,
		record.TeacherID,
		record.Day,
		record.Period,
		record.PublishedMode,
		record.PINHash,
		record.PINExpiresAt,
		record.ActorUserID,
	).Scan(&sessionID)
	if err != nil {
		return realtime.Session{}, mapError(err)
	}

	var batchID string
	err = tx.QueryRow(ctx, `
		INSERT INTO classroom_batches(session_id,batch_number,label)
		VALUES($1::uuid,1,'الدفعة 1')
		RETURNING id::text
	`, sessionID).Scan(&batchID)
	if err != nil {
		return realtime.Session{}, mapError(err)
	}
	for ordinal, ref := range record.Questions {
		if _, err = tx.Exec(ctx, `
			INSERT INTO classroom_questions(
				session_id,ordinal,batch_id,question_id,question_version
			) VALUES($1::uuid,$2,$3::uuid,$4::uuid,$5)
		`, sessionID, ordinal, batchID, ref.ID, ref.Version); err != nil {
			return realtime.Session{}, mapError(err)
		}
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  record.ActorUserID,
		Action:       "realtime.classroom.create",
		ResourceType: "classroom_session",
		ResourceID:   sessionID,
		Metadata: map[string]any{
			"schoolId":      record.SchoolID,
			"classId":       record.ClassID,
			"subjectId":     record.SubjectID,
			"questionCount": len(record.Questions),
		},
	}); err != nil {
		return realtime.Session{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return realtime.Session{}, err
	}
	return r.GetSession(ctx, sessionID)
}

func (r *Repository) GetSession(ctx context.Context, sessionID string) (realtime.Session, error) {
	out, err := scanSession(r.db.QueryRow(ctx, sessionSelect+` WHERE id=$1::uuid`, sessionID))
	return out, mapError(err)
}

func (r *Repository) FindLiveByPINHash(ctx context.Context, hash string) (realtime.Session, error) {
	out, err := scanSession(r.db.QueryRow(ctx, sessionSelect+`
		WHERE pin_hash=$1
		  AND status='live'
		  AND pin_expires_at > now()
		ORDER BY started_at DESC,created_at DESC
		LIMIT 1
	`, hash))
	return out, mapError(err)
}

func (r *Repository) ListTeacherSessions(
	ctx context.Context,
	teacherID string,
	limit int,
) ([]realtime.Session, error) {
	rows, err := r.db.Query(ctx, sessionSelect+`
		WHERE teacher_id=$1::uuid
		ORDER BY created_at DESC,id DESC
		LIMIT $2
	`, teacherID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]realtime.Session, 0, limit)
	for rows.Next() {
		item, scanErr := scanSession(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) SessionQuestions(
	ctx context.Context,
	sessionID string,
) ([]realtime.PinnedQuestion, error) {
	rows, err := r.db.Query(ctx, `
		SELECT ordinal,batch_id::text,question_id::text,question_version,published_at,revealed_at
		FROM classroom_questions
		WHERE session_id=$1::uuid
		ORDER BY ordinal
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []realtime.PinnedQuestion{}
	for rows.Next() {
		var item realtime.PinnedQuestion
		if err = rows.Scan(
			&item.Ordinal,
			&item.BatchID,
			&item.QuestionID,
			&item.QuestionVersion,
			&item.PublishedAt,
			&item.RevealedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) QuestionByOrdinal(
	ctx context.Context,
	sessionID string,
	ordinal int,
) (realtime.PinnedQuestion, error) {
	var out realtime.PinnedQuestion
	err := r.db.QueryRow(ctx, `
		SELECT ordinal,batch_id::text,question_id::text,question_version,published_at,revealed_at
		FROM classroom_questions
		WHERE session_id=$1::uuid AND ordinal=$2
	`, sessionID, ordinal).Scan(
		&out.Ordinal,
		&out.BatchID,
		&out.QuestionID,
		&out.QuestionVersion,
		&out.PublishedAt,
		&out.RevealedAt,
	)
	return out, mapError(err)
}

func (r *Repository) AppendBatch(
	ctx context.Context,
	record realtime.AppendBatchRecord,
) (realtime.Batch, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return realtime.Batch{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var status realtime.SessionStatus
	if err = tx.QueryRow(ctx, `
		SELECT status
		FROM classroom_sessions
		WHERE id=$1::uuid
		FOR UPDATE
	`, record.SessionID).Scan(&status); err != nil {
		return realtime.Batch{}, mapError(err)
	}
	if status != realtime.SessionDraft && status != realtime.SessionScheduled && status != realtime.SessionLive {
		return realtime.Batch{}, realtime.ErrConflict
	}

	var nextBatch, nextOrdinal int
	if err = tx.QueryRow(ctx, `
		SELECT COALESCE(max(batch_number),0)+1
		FROM classroom_batches
		WHERE session_id=$1::uuid
	`, record.SessionID).Scan(&nextBatch); err != nil {
		return realtime.Batch{}, err
	}
	if err = tx.QueryRow(ctx, `
		SELECT COALESCE(max(ordinal),-1)+1
		FROM classroom_questions
		WHERE session_id=$1::uuid
	`, record.SessionID).Scan(&nextOrdinal); err != nil {
		return realtime.Batch{}, err
	}

	var batchID string
	if err = tx.QueryRow(ctx, `
		INSERT INTO classroom_batches(session_id,batch_number,label)
		VALUES($1::uuid,$2,$3)
		RETURNING id::text
	`, record.SessionID, nextBatch, record.Label).Scan(&batchID); err != nil {
		return realtime.Batch{}, mapError(err)
	}
	for index, ref := range record.Questions {
		if _, err = tx.Exec(ctx, `
			INSERT INTO classroom_questions(
				session_id,ordinal,batch_id,question_id,question_version
			) VALUES($1::uuid,$2,$3::uuid,$4::uuid,$5)
		`, record.SessionID, nextOrdinal+index, batchID, ref.ID, ref.Version); err != nil {
			return realtime.Batch{}, mapError(err)
		}
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  record.ActorUserID,
		Action:       "realtime.classroom.batch.append",
		ResourceType: "classroom_session",
		ResourceID:   record.SessionID,
		Metadata: map[string]any{
			"batchId":       batchID,
			"batchNumber":   nextBatch,
			"questionCount": len(record.Questions),
		},
	}); err != nil {
		return realtime.Batch{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return realtime.Batch{}, err
	}
	return r.GetBatch(ctx, record.SessionID, batchID)
}

func (r *Repository) GetBatch(
	ctx context.Context,
	sessionID, batchID string,
) (realtime.Batch, error) {
	var out realtime.Batch
	err := r.db.QueryRow(ctx, `
		SELECT id::text,session_id::text,batch_number,label,started_at,ended_at,
		       competition_enabled,challenge_duration_seconds,timer_started_at,timer_ends_at,created_at
		FROM classroom_batches
		WHERE id=$1::uuid AND session_id=$2::uuid
	`, batchID, sessionID).Scan(
		&out.ID,
		&out.SessionID,
		&out.BatchNumber,
		&out.Label,
		&out.StartedAt,
		&out.EndedAt,
		&out.CompetitionEnabled,
		&out.ChallengeDurationSeconds,
		&out.TimerStartedAt,
		&out.TimerEndsAt,
		&out.CreatedAt,
	)
	if err != nil {
		return realtime.Batch{}, mapError(err)
	}
	rows, err := r.db.Query(ctx, `
		SELECT ordinal,batch_id::text,question_id::text,question_version,published_at,revealed_at
		FROM classroom_questions
		WHERE session_id=$1::uuid AND batch_id=$2::uuid
		ORDER BY ordinal
	`, sessionID, batchID)
	if err != nil {
		return realtime.Batch{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var item realtime.PinnedQuestion
		if err = rows.Scan(
			&item.Ordinal,
			&item.BatchID,
			&item.QuestionID,
			&item.QuestionVersion,
			&item.PublishedAt,
			&item.RevealedAt,
		); err != nil {
			return realtime.Batch{}, err
		}
		out.Questions = append(out.Questions, item)
	}
	return out, rows.Err()
}

func (r *Repository) StartSession(
	ctx context.Context,
	sessionID, actorID string,
	expectedRevision int,
) (realtime.Session, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return realtime.Session{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var status realtime.SessionStatus
	var revision int
	if err = tx.QueryRow(ctx, `
		SELECT status,revision
		FROM classroom_sessions
		WHERE id=$1::uuid
		FOR UPDATE
	`, sessionID).Scan(&status, &revision); err != nil {
		return realtime.Session{}, mapError(err)
	}
	if status == realtime.SessionLive {
		if err = tx.Commit(ctx); err != nil {
			return realtime.Session{}, err
		}
		return r.GetSession(ctx, sessionID)
	}
	if status != realtime.SessionDraft && status != realtime.SessionScheduled {
		return realtime.Session{}, realtime.ErrConflict
	}
	if expectedRevision > 0 && revision != expectedRevision {
		return realtime.Session{}, realtime.ErrConflict
	}
	now := time.Now().UTC()
	_, err = tx.Exec(ctx, `
		UPDATE classroom_sessions
		SET status='live',started_at=$2,ended_at=NULL,revision=revision+1,updated_at=$2
		WHERE id=$1::uuid
	`, sessionID, now)
	if err != nil {
		return realtime.Session{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "realtime.classroom.start",
		ResourceType: "classroom_session",
		ResourceID:   sessionID,
	}); err != nil {
		return realtime.Session{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return realtime.Session{}, mapError(err)
	}
	return r.GetSession(ctx, sessionID)
}

func (r *Repository) PublishQuestion(
	ctx context.Context,
	sessionID, actorID string,
	ordinal int,
) (realtime.Session, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return realtime.Session{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var mode realtime.PublishedMode
	var status realtime.SessionStatus
	if err = tx.QueryRow(ctx, `
		SELECT status,published_mode
		FROM classroom_sessions
		WHERE id=$1::uuid
		FOR UPDATE
	`, sessionID).Scan(&status, &mode); err != nil {
		return realtime.Session{}, mapError(err)
	}
	if status != realtime.SessionLive {
		return realtime.Session{}, realtime.ErrConflict
	}

	var batchID string
	var batchEnded *time.Time
	if err = tx.QueryRow(ctx, `
		SELECT q.batch_id::text,b.ended_at
		FROM classroom_questions q
		JOIN classroom_batches b ON b.id=q.batch_id AND b.session_id=q.session_id
		WHERE q.session_id=$1::uuid AND q.ordinal=$2
		FOR UPDATE OF q,b
	`, sessionID, ordinal).Scan(&batchID, &batchEnded); err != nil {
		return realtime.Session{}, mapError(err)
	}
	if batchEnded != nil {
		return realtime.Session{}, realtime.ErrConflict
	}

	now := time.Now().UTC()
	if _, err = tx.Exec(ctx, `
		UPDATE classroom_batches
		SET started_at=COALESCE(started_at,$3)
		WHERE id=$1::uuid AND session_id=$2::uuid
	`, batchID, sessionID, now); err != nil {
		return realtime.Session{}, err
	}
	if mode == realtime.PublishedBatch {
		if _, err = tx.Exec(ctx, `
			UPDATE classroom_questions
			SET published_at=COALESCE(published_at,$3)
			WHERE session_id=$1::uuid AND batch_id=$2::uuid
		`, sessionID, batchID, now); err != nil {
			return realtime.Session{}, err
		}
	} else {
		if _, err = tx.Exec(ctx, `
			UPDATE classroom_questions
			SET published_at=COALESCE(published_at,$3)
			WHERE session_id=$1::uuid AND ordinal=$2
		`, sessionID, ordinal, now); err != nil {
			return realtime.Session{}, err
		}
	}
	if _, err = tx.Exec(ctx, `
		UPDATE classroom_sessions
		SET active_batch_id=$2::uuid,active_question_ordinal=$3,revision=revision+1,updated_at=$4
		WHERE id=$1::uuid
	`, sessionID, batchID, ordinal, now); err != nil {
		return realtime.Session{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "realtime.classroom.question.publish",
		ResourceType: "classroom_session",
		ResourceID:   sessionID,
		Metadata:     map[string]any{"ordinal": ordinal, "batchId": batchID, "mode": mode},
	}); err != nil {
		return realtime.Session{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return realtime.Session{}, err
	}
	return r.GetSession(ctx, sessionID)
}

func (r *Repository) RevealQuestion(
	ctx context.Context,
	sessionID, actorID string,
	ordinal int,
) (realtime.PinnedQuestion, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return realtime.PinnedQuestion{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	now := time.Now().UTC()

	var publishedAt *time.Time
	var revealedAt *time.Time
	var out realtime.PinnedQuestion
	err = tx.QueryRow(ctx, `
		SELECT q.ordinal,q.batch_id::text,q.question_id::text,q.question_version,q.published_at,q.revealed_at
		FROM classroom_questions q
		JOIN classroom_sessions s ON s.id=q.session_id
		WHERE q.session_id=$1::uuid AND q.ordinal=$2 AND s.status='live'
		FOR UPDATE OF q
	`, sessionID, ordinal).Scan(
		&out.Ordinal,
		&out.BatchID,
		&out.QuestionID,
		&out.QuestionVersion,
		&publishedAt,
		&revealedAt,
	)
	if err != nil {
		return realtime.PinnedQuestion{}, mapError(err)
	}
	if publishedAt == nil {
		return realtime.PinnedQuestion{}, realtime.ErrConflict
	}
	if revealedAt == nil {
		if _, err = tx.Exec(ctx, `
			UPDATE classroom_questions
			SET revealed_at=$3
			WHERE session_id=$1::uuid AND ordinal=$2
		`, sessionID, ordinal, now); err != nil {
			return realtime.PinnedQuestion{}, err
		}
		if _, err = tx.Exec(ctx, `
			UPDATE classroom_sessions SET revision=revision+1,updated_at=$2 WHERE id=$1::uuid
		`, sessionID, now); err != nil {
			return realtime.PinnedQuestion{}, err
		}
		revealedAt = &now
	}
	out.PublishedAt = publishedAt
	out.RevealedAt = revealedAt
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "realtime.classroom.question.reveal",
		ResourceType: "classroom_session",
		ResourceID:   sessionID,
		Metadata:     map[string]any{"ordinal": ordinal},
	}); err != nil {
		return realtime.PinnedQuestion{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return realtime.PinnedQuestion{}, err
	}
	return out, nil
}

func (r *Repository) EndBatch(
	ctx context.Context,
	sessionID, batchID, actorID string,
) (realtime.Batch, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return realtime.Batch{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var status realtime.SessionStatus
	var activeBatchID string
	if err = tx.QueryRow(ctx, `
		SELECT status,COALESCE(active_batch_id::text,'')
		FROM classroom_sessions
		WHERE id=$1::uuid
		FOR UPDATE
	`, sessionID).Scan(&status, &activeBatchID); err != nil {
		return realtime.Batch{}, mapError(err)
	}
	if status != realtime.SessionLive {
		return realtime.Batch{}, realtime.ErrConflict
	}
	var endedAt *time.Time
	if err = tx.QueryRow(ctx, `
		SELECT ended_at
		FROM classroom_batches
		WHERE id=$1::uuid AND session_id=$2::uuid
		FOR UPDATE
	`, batchID, sessionID).Scan(&endedAt); err != nil {
		return realtime.Batch{}, mapError(err)
	}
	now := time.Now().UTC()
	if endedAt == nil {
		if _, err = tx.Exec(ctx, `
			UPDATE classroom_batches
			SET started_at=COALESCE(started_at,$3),ended_at=$3
			WHERE id=$1::uuid AND session_id=$2::uuid
		`, batchID, sessionID, now); err != nil {
			return realtime.Batch{}, err
		}
	}
	if activeBatchID == batchID {
		if _, err = tx.Exec(ctx, `
			UPDATE classroom_sessions
			SET active_batch_id=NULL,active_question_ordinal=NULL,revision=revision+1,updated_at=$2
			WHERE id=$1::uuid
		`, sessionID, now); err != nil {
			return realtime.Batch{}, err
		}
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "realtime.classroom.batch.end",
		ResourceType: "classroom_session",
		ResourceID:   sessionID,
		Metadata:     map[string]any{"batchId": batchID},
	}); err != nil {
		return realtime.Batch{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return realtime.Batch{}, err
	}
	return r.GetBatch(ctx, sessionID, batchID)
}

var _ = errors.Is
var _ pgx.Tx
