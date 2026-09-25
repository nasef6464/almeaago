package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

var (
	errAuditWriterUnavailable          = errors.New("organization audit writer is not configured")
	errStudentAccountWriterUnavailable = errors.New("student account writer is not configured")
)

type AuditWriter interface {
	WriteTx(ctx context.Context, tx pgx.Tx, event operations.AuditEvent) error
}

type StudentAccountWriter interface {
	UpsertSchoolStudentTx(
		ctx context.Context,
		tx pgx.Tx,
		name string,
		email string,
		password string,
	) (identity.SchoolStudentAccount, bool, error)
	UpdateSchoolStudentBasicTx(
		ctx context.Context,
		tx pgx.Tx,
		userID string,
		name *string,
		phone *string,
	) (identity.SchoolStudentAccount, error)
	SetSchoolStudentActiveTx(
		ctx context.Context,
		tx pgx.Tx,
		userID string,
		active bool,
	) (identity.SchoolStudentAccount, error)
	SchoolStudentAccountTx(
		ctx context.Context,
		tx pgx.Tx,
		userID string,
	) (identity.SchoolStudentAccount, error)
}

type Repository struct {
	db              *pgxpool.Pool
	audit           AuditWriter
	studentAccounts StudentAccountWriter
}

func New(db *pgxpool.Pool, audit AuditWriter, studentAccounts ...StudentAccountWriter) *Repository {
	var writer StudentAccountWriter
	if len(studentAccounts) > 0 {
		writer = studentAccounts[0]
	}
	return &Repository{
		db:              db,
		audit:           audit,
		studentAccounts: writer,
	}
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanSchool(row rowScanner) (org.School, error) {
	var school org.School
	var metadata []byte
	err := row.Scan(
		&school.ID,
		&school.Code,
		&school.Name,
		&school.Status,
		&metadata,
		&school.CreatedAt,
		&school.UpdatedAt,
	)
	if err != nil {
		return org.School{}, err
	}
	school.Metadata = json.RawMessage(metadata)
	return school, nil
}

func scanClass(row rowScanner) (org.Class, error) {
	var class org.Class
	var metadata []byte
	err := row.Scan(
		&class.ID,
		&class.SchoolID,
		&class.Code,
		&class.Name,
		&class.Status,
		&metadata,
		&class.CreatedAt,
		&class.UpdatedAt,
	)
	if err != nil {
		return org.Class{}, err
	}
	class.Metadata = json.RawMessage(metadata)
	return class, nil
}

func (r *Repository) writeAudit(
	ctx context.Context,
	tx pgx.Tx,
	event operations.AuditEvent,
) error {
	if r.audit == nil {
		return errAuditWriterUnavailable
	}
	return r.audit.WriteTx(ctx, tx, event)
}

func hasRole(roles []identity.Role, target identity.Role) bool {
	for _, role := range roles {
		if role == target {
			return true
		}
	}
	return false
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
