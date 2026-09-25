package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type AdminScopeWriter struct {
	audit AuditWriter
}

func NewAdminScopeWriter(audit AuditWriter) *AdminScopeWriter {
	return &AdminScopeWriter{audit: audit}
}

func (w *AdminScopeWriter) SyncTx(
	ctx context.Context,
	tx pgx.Tx,
	command identity.AdminTrainerScopeCommand,
) error {
	if command.RoleChanged {
		if _, err := tx.Exec(ctx, `DELETE FROM content_trainer_path_scopes WHERE user_id=$1::uuid`, command.UserID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM content_trainer_subject_scopes WHERE user_id=$1::uuid`, command.UserID); err != nil {
			return err
		}
	}

	if command.PathIDs == nil && command.SubjectIDs == nil {
		if command.RoleChanged {
			return w.writeScopeAudit(ctx, tx, command)
		}
		return nil
	}

	pathIDs := []string{}
	if command.PathIDs != nil {
		pathIDs = append(pathIDs, (*command.PathIDs)...)
	}
	subjectIDs := []string{}
	if command.SubjectIDs != nil {
		subjectIDs = append(subjectIDs, (*command.SubjectIDs)...)
	}

	if !command.IsTrainer {
		if len(pathIDs) > 0 || len(subjectIDs) > 0 {
			return identity.ErrAdminScopeConflict
		}
		if command.PathIDs != nil {
			if _, err := tx.Exec(ctx, `DELETE FROM content_trainer_path_scopes WHERE user_id=$1::uuid`, command.UserID); err != nil {
				return err
			}
		}
		if command.SubjectIDs != nil {
			if _, err := tx.Exec(ctx, `DELETE FROM content_trainer_subject_scopes WHERE user_id=$1::uuid`, command.UserID); err != nil {
				return err
			}
		}
		return w.writeScopeAudit(ctx, tx, command)
	}

	if len(pathIDs) > 50 || len(subjectIDs) > 200 {
		return identity.ErrAdminScopeConflict
	}
	if err := validateTeacherTx(ctx, tx, command.UserID); err != nil {
		return identity.ErrAdminScopeConflict
	}
	if err := validateActiveIDsTx(ctx, tx, "paths", "id", pathIDs, "status='active'"); err != nil {
		if errors.Is(err, identity.ErrAdminScopeConflict) {
			return err
		}
		return identity.ErrAdminScopeConflict
	}
	if err := validateActiveIDsTx(ctx, tx, "subjects", "id", subjectIDs, "status='active'"); err != nil {
		return identity.ErrAdminScopeConflict
	}

	if command.PathIDs != nil {
		if _, err := tx.Exec(ctx, `DELETE FROM content_trainer_path_scopes WHERE user_id=$1::uuid`, command.UserID); err != nil {
			return err
		}
		for _, pathID := range pathIDs {
			if _, err := tx.Exec(ctx, `
				INSERT INTO content_trainer_path_scopes(user_id,path_id,created_by)
				VALUES($1::uuid,$2::uuid,$3::uuid)
			`, command.UserID, pathID, command.ActorUserID); err != nil {
				return err
			}
		}
	}

	if command.SubjectIDs != nil {
		if _, err := tx.Exec(ctx, `DELETE FROM content_trainer_subject_scopes WHERE user_id=$1::uuid`, command.UserID); err != nil {
			return err
		}
		for _, subjectID := range subjectIDs {
			if _, err := tx.Exec(ctx, `
				INSERT INTO content_trainer_subject_scopes(user_id,subject_id,created_by)
				VALUES($1::uuid,$2::uuid,$3::uuid)
			`, command.UserID, subjectID, command.ActorUserID); err != nil {
				return err
			}
		}
	}

	return w.writeScopeAudit(ctx, tx, command)
}

func (w *AdminScopeWriter) SnapshotTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
) (identity.AdminTrainerScopeSnapshot, error) {
	var snapshot identity.AdminTrainerScopeSnapshot
	err := tx.QueryRow(ctx, `
		SELECT
			ARRAY(
				SELECT path_id::text
				FROM content_trainer_path_scopes
				WHERE user_id=u.id
				ORDER BY path_id
			)::text[],
			ARRAY(
				SELECT subject_id::text
				FROM content_trainer_subject_scopes
				WHERE user_id=u.id
				ORDER BY subject_id
			)::text[]
		FROM users u
		WHERE u.id=$1::uuid
	`, userID).Scan(&snapshot.PathIDs, &snapshot.SubjectIDs)
	if errors.Is(err, pgx.ErrNoRows) {
		return identity.AdminTrainerScopeSnapshot{}, identity.ErrNotFound
	}
	if err != nil {
		return identity.AdminTrainerScopeSnapshot{}, err
	}
	if snapshot.PathIDs == nil {
		snapshot.PathIDs = []string{}
	}
	if snapshot.SubjectIDs == nil {
		snapshot.SubjectIDs = []string{}
	}
	return snapshot, nil
}

func (w *AdminScopeWriter) writeScopeAudit(
	ctx context.Context,
	tx pgx.Tx,
	command identity.AdminTrainerScopeCommand,
) error {
	if w.audit == nil {
		return errors.New("content admin scope audit writer is not configured")
	}
	pathIDs := []string(nil)
	if command.PathIDs != nil {
		pathIDs = append([]string(nil), (*command.PathIDs)...)
	}
	subjectIDs := []string(nil)
	if command.SubjectIDs != nil {
		subjectIDs = append([]string(nil), (*command.SubjectIDs)...)
	}
	return w.audit.WriteTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  command.ActorUserID,
		Action:       "content.trainer_scope.compat_sync",
		ResourceType: "content_trainer_scope",
		ResourceID:   command.UserID,
		Metadata: map[string]any{
			"roleChanged": command.RoleChanged,
			"pathIds":     pathIDs,
			"subjectIds":  subjectIDs,
		},
	})
}
