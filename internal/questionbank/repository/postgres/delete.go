package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

var ErrQuestionHasDependencies = question.ErrHasDependencies

// CanTrainerDeleteQuestion verifies that a trainer has both manageQuestions and canDelete
// permissions and is scoped to the question's path or subject.
func (r *Repository) CanTrainerDeleteQuestion(ctx context.Context, userID, pathID, subjectID string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT
			COALESCE((SELECT (permissions->>'manageQuestions')::boolean FROM content_trainer_permissions WHERE user_id=$1::uuid), false)
			AND COALESCE((SELECT (permissions->>'canDelete')::boolean FROM content_trainer_permissions WHERE user_id=$1::uuid), false)
			AND (
				EXISTS(SELECT 1 FROM content_trainer_path_scopes ps JOIN paths p ON p.id=ps.path_id WHERE ps.user_id=$1::uuid AND ps.path_id=$2::uuid AND p.status='active')
				OR EXISTS(SELECT 1 FROM content_trainer_subject_scopes ss JOIN subjects s ON s.id=ss.subject_id WHERE ss.user_id=$1::uuid AND ss.subject_id=NULLIF($3,'')::uuid AND s.path_id=$2::uuid AND s.status='active')
			)
	`, userID, pathID, subjectID).Scan(&ok)
	return ok, err
}

// DeleteQuestion permanently deletes an unreferenced question inside a transaction.
// Any external FK reference (e.g. assessment_version_questions, learning_evidence, attempts)
// returns ErrQuestionHasDependencies.
func (r *Repository) DeleteQuestion(ctx context.Context, actorUserID, id string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var locked string
	if err = tx.QueryRow(ctx, `SELECT id::text FROM questions WHERE id=$1::uuid FOR UPDATE`, id).Scan(&locked); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return question.ErrNotFound
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
		  AND f.confrelid = ANY(ARRAY[to_regclass('questions'), to_regclass('question_versions')])
		  AND parent.attname IN ('id', 'question_id')
		  AND NOT (n.nspname = 'public' AND c.relname IN ('question_versions', 'question_options', 'question_skill_links'))
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
			return ErrQuestionHasDependencies
		}
	}

	if _, err = tx.Exec(ctx, `DELETE FROM question_versions WHERE question_id=$1::uuid`, id); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM questions WHERE id=$1::uuid`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return question.ErrNotFound
	}

	if r.audit != nil {
		if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
			ActorUserID:  actorUserID,
			Action:       "question.deleted",
			ResourceType: "question",
			ResourceID:   id,
		}); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
