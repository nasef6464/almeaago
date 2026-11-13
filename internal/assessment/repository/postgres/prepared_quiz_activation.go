package postgres

import (
	"context"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

// SetPreparedQuizEnabled locks the assessment before its distribution, the
// same ordering used by staging and start guards. Its caller must authorize.
func (r *Repository) SetPreparedQuizEnabled(ctx context.Context, actor, id string, enable bool) (bool, bool, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return false, false, err
	}
	defer tx.Rollback(ctx)
	var version *int
	if err = tx.QueryRow(ctx, `SELECT published_version FROM assessments WHERE id=$1::uuid FOR UPDATE`, id).Scan(&version); err != nil {
		return false, false, mapError(err)
	}
	var active, was bool
	if err = tx.QueryRow(ctx, `SELECT enabled,was_enabled FROM prepared_quiz_distributions WHERE assessment_id=$1::uuid FOR UPDATE`, id).Scan(&active, &was); err != nil {
		return false, false, mapError(err)
	}
	if active == enable {
		if err = tx.Commit(ctx); err != nil {
			return false, false, err
		}
		return active, was, nil
	}
	if enable {
		var ready bool
		if version == nil {
			return false, false, assessment.ErrConflict
		}
		if err = tx.QueryRow(ctx, `SELECT prepared_quiz_ready($1::uuid,$2)`, id, *version).Scan(&ready); err != nil {
			return false, false, err
		}
		if !ready {
			return false, false, assessment.ErrConflict
		}
	}
	if err = tx.QueryRow(ctx, `UPDATE prepared_quiz_distributions SET enabled=$2,updated_at=now() WHERE assessment_id=$1::uuid RETURNING enabled,was_enabled`, id, enable).Scan(&active, &was); err != nil {
		return false, false, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "assessment.prepared.status", ResourceType: "assessment", ResourceID: id, Metadata: map[string]any{"enabled": active}}); err != nil {
		return false, false, err
	}
	if err = tx.Commit(ctx); err != nil {
		return false, false, err
	}
	return active, was, nil
}
