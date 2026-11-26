package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

var ErrAssessmentHasDependencies = assessment.ErrHasDependencies

// CanTrainerDeleteAssessment verifies that a trainer has manageAssessments + canDelete
// and is scoped to the assessment's path or subject.
func (r *Repository) CanTrainerDeleteAssessment(ctx context.Context, userID, pathID, subjectID string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT
			COALESCE((SELECT (permissions->>'manageAssessments')::boolean FROM content_trainer_permissions WHERE user_id=$1::uuid), false)
			AND COALESCE((SELECT (permissions->>'canDelete')::boolean FROM content_trainer_permissions WHERE user_id=$1::uuid), false)
			AND (
				EXISTS(SELECT 1 FROM content_trainer_path_scopes ps JOIN paths p ON p.id=ps.path_id WHERE ps.user_id=$1::uuid AND ps.path_id=$2::uuid AND p.status='active')
				OR EXISTS(SELECT 1 FROM content_trainer_subject_scopes ss JOIN subjects s ON s.id=ss.subject_id WHERE ss.user_id=$1::uuid AND ss.subject_id=NULLIF($3,'')::uuid AND s.path_id=$2::uuid AND s.status='active')
			)
	`, userID, pathID, subjectID).Scan(&ok)
	return ok, err
}

// DeleteAssessment permanently deletes an unreferenced assessment inside a transaction.
// Any external reference (attempts, sessions, assignments, placements, results, staging)
// returns ErrAssessmentHasDependencies.
func (r *Repository) DeleteAssessment(ctx context.Context, actorUserID, id string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var locked string
	if err = tx.QueryRow(ctx, `SELECT id::text FROM assessments WHERE id=$1::uuid FOR UPDATE`, id).Scan(&locked); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return assessment.ErrNotFound
		}
		return err
	}

	rows, err := tx.Query(ctx, `
		SELECT n.nspname, c.relname, a.attname
		FROM pg_constraint f
		JOIN pg_class c ON c.oid = f.conrelid
		JOIN pg_namespace n ON n.oid = c.relnamespace
		JOIN LATERAL unnest(f.conkey, f.confkey) AS cols(child_col, parent_col) ON true
		JOIN pg_attribute a ON a.attrelid = f.conrelid AND a.attnum = cols.child_col
		JOIN pg_attribute parent ON parent.attrelid = f.confrelid AND parent.attnum = cols.parent_col
		WHERE f.contype = 'f'
		  AND f.confrelid = ANY(ARRAY[to_regclass('assessments'), to_regclass('assessment_versions')])
		  AND parent.attname IN ('id', 'assessment_id')
		  AND NOT (n.nspname = 'public' AND c.relname IN ('assessment_versions', 'assessment_sections', 'assessment_version_questions'))
	`)
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
			return ErrAssessmentHasDependencies
		}
	}

	if _, err = tx.Exec(ctx, `DELETE FROM assessment_version_questions WHERE assessment_id=$1::uuid`, id); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM assessment_sections WHERE assessment_id=$1::uuid`, id); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM assessment_versions WHERE assessment_id=$1::uuid`, id); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM assessments WHERE id=$1::uuid`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return assessment.ErrNotFound
	}

	if r.audit != nil {
		if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
			ActorUserID:  actorUserID,
			Action:       "assessment.deleted",
			ResourceType: "assessment",
			ResourceID:   id,
		}); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// DeletePlacement removes an assessment learning placement record inside a transaction.
func (r *Repository) DeletePlacement(ctx context.Context, actorUserID, id string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `DELETE FROM assessment_learning_placements WHERE id=$1::uuid`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return assessment.ErrNotFound
	}

	if r.audit != nil {
		if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
			ActorUserID:  actorUserID,
			Action:       "assessment_placement.deleted",
			ResourceType: "assessment_placement",
			ResourceID:   id,
		}); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
