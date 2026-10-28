package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// Both evidence writers must take this lock before reading replay state or
// touching cards/evidence/progress. Locking only existing progress rows misses
// the first insert; locking cards alone misses different questions for one skill.
// READ COMMITTED in the callers gives subsequent statements a fresh snapshot
// after a preceding writer commits. PostgreSQL releases this lock with the tx.
func lockStudentEvidenceTx(ctx context.Context, tx pgx.Tx, studentID string) error {
	_, err := tx.Exec(ctx, `
  SELECT pg_advisory_xact_lock(hashtextextended('learning-evidence:' || $1::uuid::text, 0))
 `, studentID)
	return err
}
