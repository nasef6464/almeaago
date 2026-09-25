package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type AuditWriter interface {
	WriteTx(ctx context.Context, tx pgx.Tx, event operations.AuditEvent) error
}

type Repository struct {
	db    *pgxpool.Pool
	audit AuditWriter
}

func New(db *pgxpool.Pool, audit AuditWriter) *Repository {
	return &Repository{db: db, audit: audit}
}

type rowScanner interface {
	Scan(dest ...any) error
}
