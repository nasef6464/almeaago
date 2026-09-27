package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	realtime "github.com/nasef6464/almeaago/internal/realtime/domain"
)

type AuditWriter interface {
	WriteTx(context.Context, pgx.Tx, operations.AuditEvent) error
}

type Repository struct {
	db    *pgxpool.Pool
	audit AuditWriter
}

func New(db *pgxpool.Pool, audit AuditWriter) *Repository {
	return &Repository{db: db, audit: audit}
}

type scanner interface {
	Scan(...any) error
}

const sessionSelect = `
	SELECT
		id::text,school_id::text,class_id::text,subject_id::text,teacher_id::text,status,
		day,period,published_mode,COALESCE(active_batch_id::text,''),active_question_ordinal,
		pin_expires_at,revision,started_at,ended_at,created_at,updated_at
	FROM classroom_sessions
`

func scanSession(row scanner) (realtime.Session, error) {
	var out realtime.Session
	err := row.Scan(
		&out.ID,
		&out.SchoolID,
		&out.ClassID,
		&out.SubjectID,
		&out.TeacherID,
		&out.Status,
		&out.Day,
		&out.Period,
		&out.PublishedMode,
		&out.ActiveBatchID,
		&out.ActiveQuestionOrdinal,
		&out.PINExpiresAt,
		&out.Revision,
		&out.StartedAt,
		&out.EndedAt,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	return out, err
}

func mapError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return realtime.ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505", "23503", "23514", "23P01", "22P02":
			return realtime.ErrConflict
		}
	}
	return err
}

func (r *Repository) auditTx(ctx context.Context, tx pgx.Tx, event operations.AuditEvent) error {
	if r.audit == nil {
		return errors.New("realtime audit writer is not configured")
	}
	return r.audit.WriteTx(ctx, tx, event)
}
