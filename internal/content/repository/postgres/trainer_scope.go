package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) GetTrainerScope(ctx context.Context, userID string) (content.TrainerScope, error) {
	userID = strings.TrimSpace(userID)
	var teacher bool
	if err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM users u
			JOIN user_roles ur ON ur.user_id=u.id
			WHERE u.id=$1::uuid AND ur.role='teacher'
		)
	`, userID).Scan(&teacher); err != nil {
		return content.TrainerScope{}, mapError(err)
	}
	if !teacher {
		return content.TrainerScope{}, content.ErrNotFound
	}
	scope := content.TrainerScope{UserID: userID, PathIDs: []string{}, SubjectIDs: []string{}}
	var err error
	scope.PathIDs, err = r.loadIDs(ctx, `
		SELECT path_id::text
		FROM content_trainer_path_scopes
		WHERE user_id=$1::uuid
		ORDER BY path_id
	`, userID)
	if err != nil {
		return content.TrainerScope{}, err
	}
	scope.SubjectIDs, err = r.loadIDs(ctx, `
		SELECT subject_id::text
		FROM content_trainer_subject_scopes
		WHERE user_id=$1::uuid
		ORDER BY subject_id
	`, userID)
	if err != nil {
		return content.TrainerScope{}, err
	}
	return scope, nil
}

func (r *Repository) SetTrainerScope(ctx context.Context, actorUserID, userID string, pathIDs, subjectIDs []string) (content.TrainerScope, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.TrainerScope{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := validateTeacherTx(ctx, tx, userID); err != nil {
		return content.TrainerScope{}, err
	}
	if err := validateActiveIDsTx(ctx, tx, "paths", "id", pathIDs, "status='active'"); err != nil {
		return content.TrainerScope{}, err
	}
	if err := validateActiveIDsTx(ctx, tx, "subjects", "id", subjectIDs, "status='active'"); err != nil {
		return content.TrainerScope{}, err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM content_trainer_path_scopes WHERE user_id=$1::uuid`, userID); err != nil {
		return content.TrainerScope{}, err
	}
	for _, pathID := range pathIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO content_trainer_path_scopes(user_id,path_id,created_by)
			VALUES($1::uuid,$2::uuid,$3::uuid)
		`, userID, pathID, actorUserID); err != nil {
			return content.TrainerScope{}, mapError(err)
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM content_trainer_subject_scopes WHERE user_id=$1::uuid`, userID); err != nil {
		return content.TrainerScope{}, err
	}
	for _, subjectID := range subjectIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO content_trainer_subject_scopes(user_id,subject_id,created_by)
			VALUES($1::uuid,$2::uuid,$3::uuid)
		`, userID, subjectID, actorUserID); err != nil {
			return content.TrainerScope{}, mapError(err)
		}
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID,
		Action: "content.trainer_scope.update",
		ResourceType: "content_trainer_scope",
		ResourceID: userID,
		Metadata: map[string]any{"pathIds": pathIDs, "subjectIds": subjectIDs},
	}); err != nil {
		return content.TrainerScope{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.TrainerScope{}, err
	}
	return content.TrainerScope{UserID: userID, PathIDs: append([]string(nil), pathIDs...), SubjectIDs: append([]string(nil), subjectIDs...)}, nil
}

func (r *Repository) CanAuthor(ctx context.Context, userID, pathID, subjectID string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM users u
			JOIN user_roles ur ON ur.user_id=u.id AND ur.role='teacher'
			WHERE u.id=$1::uuid AND u.status='active'
			  AND (
				EXISTS(
					SELECT 1
					FROM content_trainer_path_scopes ps
					JOIN paths p ON p.id=ps.path_id
					WHERE ps.user_id=u.id AND ps.path_id=$2::uuid AND p.status='active'
				)
				OR EXISTS(
					SELECT 1
					FROM content_trainer_subject_scopes ss
					JOIN subjects s ON s.id=ss.subject_id
					WHERE ss.user_id=u.id AND ss.subject_id=$3::uuid
					  AND s.path_id=$2::uuid AND s.status='active'
				)
			  )
		)
	`, userID, pathID, subjectID).Scan(&ok)
	if err != nil {
		return false, mapError(err)
	}
	return ok, nil
}

func validateActiveIDsTx(ctx context.Context, tx pgx.Tx, table, column string, ids []string, predicate string) error {
	if len(ids) == 0 {
		return nil
	}
	if table != "paths" && table != "subjects" || column != "id" {
		return fmt.Errorf("unsupported trainer scope reference")
	}
	args := make([]any, 0, len(ids))
	placeholders := make([]string, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
		placeholders = append(placeholders, fmt.Sprintf("$%d::uuid", len(args)))
	}
	query := "SELECT count(*) FROM " + table + " WHERE " + column + " IN (" + strings.Join(placeholders, ",") + ") AND " + predicate
	var count int
	if err := tx.QueryRow(ctx, query, args...).Scan(&count); err != nil {
		return mapError(err)
	}
	if count != len(ids) {
		return content.ErrInvalidTaxonomy
	}
	return nil
}
