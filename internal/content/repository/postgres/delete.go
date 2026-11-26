package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

var (
	ErrContentNotFound        = content.ErrNotFound
	ErrContentHasDependencies = content.ErrHasDependencies
)

var contentTables = map[string]string{
	"course":           "courses",
	"lesson":           "lessons",
	"foundation_topic": "foundation_topics",
	"library_item":     "library_items",
	"course_module":    "course_modules",
}

// DeleteContentRecord safely deletes an unreferenced content record inside a transaction.
// Every FK reference across public schema is checked via pg_constraint so student progress,
// enrollments, or attempts are never detached or erased.
func (r *Repository) DeleteContentRecord(ctx context.Context, actorUserID, kind, id string) error {
	table, ok := contentTables[kind]
	if !ok {
		return content.ErrNotFound
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var locked string
	if err = tx.QueryRow(
		ctx,
		fmt.Sprintf("SELECT id::text FROM %s WHERE id=$1::uuid FOR UPDATE", pgx.Identifier{table}.Sanitize()),
		id,
	).Scan(&locked); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return content.ErrNotFound
		}
		return mapError(err)
	}

	rows, err := tx.Query(ctx, `
		SELECT n.nspname, c.relname, a.attname
		FROM pg_constraint f
		JOIN pg_class c ON c.oid = f.conrelid
		JOIN pg_namespace n ON n.oid = c.relnamespace
		JOIN LATERAL unnest(f.conkey, f.confkey) AS cols(child_col, parent_col) ON true
		JOIN pg_attribute a ON a.attrelid = f.conrelid AND a.attnum = cols.child_col
		JOIN pg_attribute parent ON parent.attrelid = f.confrelid AND parent.attnum = cols.parent_col
		WHERE f.contype = 'f' AND f.confrelid = to_regclass($1) AND parent.attname = 'id'
	`, table)
	if err != nil {
		return err
	}
	type reference struct{ schema, table, column string }
	var refs []reference
	for rows.Next() {
		var ref reference
		if err = rows.Scan(&ref.schema, &ref.table, &ref.column); err != nil {
			rows.Close()
			return err
		}
		refs = append(refs, ref)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	for _, ref := range refs {
		var exists bool
		query := fmt.Sprintf(
			"SELECT EXISTS(SELECT 1 FROM %s WHERE %s=$1::uuid)",
			pgx.Identifier{ref.schema, ref.table}.Sanitize(),
			pgx.Identifier{ref.column}.Sanitize(),
		)
		if err = tx.QueryRow(ctx, query, id).Scan(&exists); err != nil {
			return err
		}
		if exists {
			return ErrContentHasDependencies
		}
	}

	if _, err = tx.Exec(
		ctx,
		fmt.Sprintf("DELETE FROM %s WHERE id=$1::uuid", pgx.Identifier{table}.Sanitize()),
		id,
	); err != nil {
		return mapError(err)
	}

	if err = r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "content." + kind + ".delete",
		ResourceType: kind,
		ResourceID:   id,
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
