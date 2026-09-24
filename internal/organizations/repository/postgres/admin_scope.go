package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type AdminScopeWriter struct{}

func NewAdminScopeWriter() *AdminScopeWriter {
	return &AdminScopeWriter{}
}

func (w *AdminScopeWriter) SyncTx(
	ctx context.Context,
	tx pgx.Tx,
	command orgdomain.AdminAccountScopeCommand,
) error {
	if command.RoleChanged {
		if _, err := tx.Exec(ctx, `
			UPDATE school_memberships
			SET status = 'revoked', updated_at = now()
			WHERE user_id::text = $1
			  AND status = 'active'
		`, command.UserID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE class_memberships
			SET status = 'inactive',
			    left_at = COALESCE(left_at, now())
			WHERE user_id::text = $1
			  AND status = 'active'
		`, command.UserID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE parent_student_relationships
			SET status = 'revoked', updated_at = now()
			WHERE parent_user_id::text = $1
			  AND status = 'active'
		`, command.UserID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE teaching_assignments
			SET status = 'revoked', updated_at = now()
			WHERE teacher_id::text = $1
			  AND status = 'active'
		`, command.UserID); err != nil {
			return err
		}
	}

	if command.SchoolID != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE school_memberships
			SET status = 'revoked', updated_at = now()
			WHERE user_id::text = $1
			  AND status = 'active'
		`, command.UserID); err != nil {
			return err
		}

		schoolID := strings.TrimSpace(*command.SchoolID)
		if schoolID != "" && command.Role != identity.RoleAdmin {
			tag, err := tx.Exec(ctx, `
				INSERT INTO school_memberships (
					school_id, user_id, role, status
				)
				SELECT s.id, u.id, $3, 'active'
				FROM schools s
				JOIN users u ON u.id::text = $1
				WHERE s.id::text = $2
				  AND s.status = 'active'
				ON CONFLICT (school_id, user_id, role)
				DO UPDATE SET status = 'active', updated_at = now()
			`, command.UserID, schoolID, string(command.Role))
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 0 {
				return orgdomain.ErrScopeNotFound
			}
		}
	}

	if command.ClassIDs != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE class_memberships
			SET status = 'inactive',
			    left_at = COALESCE(left_at, now())
			WHERE user_id::text = $1
			  AND status = 'active'
		`, command.UserID); err != nil {
			return err
		}

		if command.Role != identity.RoleAdmin {
			schoolID, err := w.resolveSchoolID(ctx, tx, command)
			if err != nil {
				return err
			}
			for _, classID := range *command.ClassIDs {
				tag, err := tx.Exec(ctx, `
					INSERT INTO class_memberships (
						class_id, user_id, status, joined_at, left_at
					)
					SELECT c.id, u.id, 'active', now(), NULL
					FROM classes c
					JOIN users u ON u.id::text = $1
					WHERE c.id::text = $2
					  AND c.status = 'active'
					  AND ($3 = '' OR c.school_id::text = $3)
					ON CONFLICT (class_id, user_id)
					DO UPDATE SET
						status = 'active',
						joined_at = now(),
						left_at = NULL
				`, command.UserID, classID, schoolID)
				if err != nil {
					return err
				}
				if tag.RowsAffected() == 0 {
					return orgdomain.ErrScopeNotFound
				}
			}
		}
	} else if command.SchoolID != nil {
		schoolID := strings.TrimSpace(*command.SchoolID)
		if schoolID == "" || command.Role == identity.RoleAdmin {
			if _, err := tx.Exec(ctx, `
				UPDATE class_memberships
				SET status = 'inactive',
				    left_at = COALESCE(left_at, now())
				WHERE user_id::text = $1
				  AND status = 'active'
			`, command.UserID); err != nil {
				return err
			}
		} else {
			if _, err := tx.Exec(ctx, `
				UPDATE class_memberships cm
				SET status = 'inactive',
				    left_at = COALESCE(left_at, now())
				WHERE cm.user_id::text = $1
				  AND cm.status = 'active'
				  AND NOT EXISTS (
					SELECT 1
					FROM classes c
					WHERE c.id = cm.class_id
					  AND c.school_id::text = $2
				  )
			`, command.UserID, schoolID); err != nil {
				return err
			}
		}
	}

	if command.LinkedStudentIDs != nil || command.RoleChanged {
		if _, err := tx.Exec(ctx, `
			UPDATE parent_student_relationships
			SET status = 'revoked', updated_at = now()
			WHERE parent_user_id::text = $1
			  AND status = 'active'
		`, command.UserID); err != nil {
			return err
		}

		if command.Role == identity.RoleParent && command.LinkedStudentIDs != nil {
			schoolID, err := w.resolveSchoolID(ctx, tx, command)
			if err != nil {
				return err
			}
			for _, studentID := range *command.LinkedStudentIDs {
				_, err := tx.Exec(ctx, `
					INSERT INTO parent_student_relationships (
						parent_user_id,
						student_user_id,
						school_id,
						status,
						source
					)
					SELECT
						p.id,
						s.id,
						CASE
							WHEN $3 = '' THEN NULL
							ELSE (
								SELECT school.id
								FROM schools school
								WHERE school.id::text = $3
							)
						END,
						'active',
						'admin'
					FROM users p
					JOIN users s ON s.id::text = $2
					WHERE p.id::text = $1
					  AND EXISTS (
						SELECT 1
						FROM user_roles ur
						WHERE ur.user_id = s.id
						  AND ur.role = 'student'
					  )
				`, command.UserID, studentID, schoolID)
				if err != nil {
					return err
				}
			}
		}
	} else if command.SchoolID != nil && command.Role == identity.RoleParent {
		schoolID := strings.TrimSpace(*command.SchoolID)
		if schoolID == "" {
			_, err := tx.Exec(ctx, `
				UPDATE parent_student_relationships
				SET school_id = NULL, updated_at = now()
				WHERE parent_user_id::text = $1
				  AND status = 'active'
			`, command.UserID)
			if err != nil {
				return err
			}
		} else {
			tag, err := tx.Exec(ctx, `
				UPDATE parent_student_relationships
				SET school_id = (
					SELECT id FROM schools
					WHERE id::text = $2 AND status = 'active'
				),
				    updated_at = now()
				WHERE parent_user_id::text = $1
				  AND status = 'active'
			`, command.UserID, schoolID)
			if err != nil {
				return err
			}
			if tag.RowsAffected() > 0 {
				var exists bool
				if err := tx.QueryRow(ctx,
					"SELECT EXISTS (SELECT 1 FROM schools WHERE id::text = $1 AND status = 'active')",
					schoolID,
				).Scan(&exists); err != nil {
					return err
				}
				if !exists {
					return orgdomain.ErrScopeNotFound
				}
			}
		}
	}

	return nil
}

func (w *AdminScopeWriter) resolveSchoolID(
	ctx context.Context,
	tx pgx.Tx,
	command orgdomain.AdminAccountScopeCommand,
) (string, error) {
	if command.SchoolID != nil {
		return strings.TrimSpace(*command.SchoolID), nil
	}

	var schoolID string
	err := tx.QueryRow(ctx, `
		SELECT school_id::text
		FROM school_memberships
		WHERE user_id::text = $1
		  AND status = 'active'
		ORDER BY updated_at DESC, created_at DESC
		LIMIT 1
	`, command.UserID).Scan(&schoolID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return schoolID, err
}
