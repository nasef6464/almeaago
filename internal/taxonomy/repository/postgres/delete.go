package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

// DeleteTaxonomy deletes only an unreferenced record. Even cascading and
// SET NULL foreign keys are checked to avoid erasing or detaching user data.
func (r *Repository) DeleteTaxonomy(ctx context.Context, actor, kind, id string) error {
	tables := map[string]string{"path": "paths", "level": "levels", "subject": "subjects"}
	table, ok := tables[kind]
	if !ok {
		return taxonomy.ErrNotFound
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var locked string
	if err = tx.QueryRow(ctx, fmt.Sprintf("SELECT id::text FROM %s WHERE id=$1::uuid FOR UPDATE", pgx.Identifier{table}.Sanitize()), id).Scan(&locked); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return taxonomy.ErrNotFound
		}
		return mapMutationError(err)
	}
	rows, err := tx.Query(ctx, `SELECT n.nspname,c.relname,a.attname
FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN LATERAL unnest(f.conkey,f.confkey) AS cols(child_col,parent_col) ON true
JOIN pg_attribute a ON a.attrelid=f.conrelid AND a.attnum=cols.child_col
JOIN pg_attribute parent ON parent.attrelid=f.confrelid AND parent.attnum=cols.parent_col
WHERE f.contype='f' AND f.confrelid=to_regclass($1) AND parent.attname='id'`, table)
	if err != nil {
		return err
	}
	type reference struct {
		schema, table, column string
	}
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
		query := fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM %s WHERE %s=$1::uuid)", pgx.Identifier{ref.schema, ref.table}.Sanitize(), pgx.Identifier{ref.column}.Sanitize())
		if err = tx.QueryRow(ctx, query, id).Scan(&exists); err != nil {
			return err
		}
		if exists {
			return taxonomy.ErrHasDependencies
		}
	}
	if _, err = tx.Exec(ctx, fmt.Sprintf("DELETE FROM %s WHERE id=$1::uuid", pgx.Identifier{table}.Sanitize()), id); err != nil {
		return mapMutationError(err)
	}
	if err = writeTaxonomyAudit(ctx, tx, actor, "taxonomy."+kind+".delete", kind, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
