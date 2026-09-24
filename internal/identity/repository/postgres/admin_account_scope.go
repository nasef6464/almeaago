package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

func syncAdminScopesTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
	role domain.Role,
	roleChanged bool,
	schoolID *string,
	classIDs *[]string,
	linkedStudentIDs *[]string,
) error {
	if roleChanged {
		if _, err := tx.Exec(ctx, `
			UPDATE school_memberships
			SET status = 'revoked', updated_at = now()
			WHERE user_id::text = $1
			  AND status = 'active'
		`, userID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE class_memberships
			SET status = 'inactive',
			    left_at = COALESCE(left_at, now())
			WHERE user_id::text = $1
			  AND status = 'active'
		`, userID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE parent_student_relationships
			SET status = 'revoked', updated_at = now()
			WHERE parent_user_id::text = $1
			  AND status = 'active'
		`, userID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE teaching_assignments
			SET status = 'revoked', updated_at = now()
			WHERE teacher_id::text = $1
			  AND status = 'active'
		`, userID); err != nil {
			return err
		}
	}

	if schoolID != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE school_memberships
			SET status = 'revoked', updated_at = now()
			WHERE user_id::text = $1
			  AND status = 'active'
		`, userID); err != nil {
			return err
		}

		school := strings.TrimSpace(*schoolID)
		if school != "" && role != domain.RoleAdmin {
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
			`, userID, school, string(role))
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 0 {
				return domain.ErrNotFound
			}
		}
	}

	if classIDs != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE class_memberships
			SET status = 'inactive',
			    left_at = COALESCE(left_at, now())
			WHERE user_id::text = $1
			  AND status = 'active'
		`, userID); err != nil {
			return err
		}

		if role != domain.RoleAdmin {
			school := ""
			if schoolID != nil {
				school = strings.TrimSpace(*schoolID)
			} else {
				resolved, err := activeSchoolIDTx(ctx, tx, userID)
				if err != nil {
					return err
				}
				school = resolved
			}

			for _, classID := range *classIDs {
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
				`, userID, classID, school)
				if err != nil {
					return err
				}
				if tag.RowsAffected() == 0 {
					return domain.ErrNotFound
				}
			}
		}
	}

	if linkedStudentIDs != nil || roleChanged {
		if _, err := tx.Exec(ctx, `
			UPDATE parent_student_relationships
			SET status = 'revoked', updated_at = now()
			WHERE parent_user_id::text = $1
			  AND status = 'active'
		`, userID); err != nil {
			return err
		}

		if role == domain.RoleParent && linkedStudentIDs != nil {
			school := ""
			if schoolID != nil {
				school = strings.TrimSpace(*schoolID)
			} else {
				resolved, err := activeSchoolIDTx(ctx, tx, userID)
				if err != nil {
					return err
				}
				school = resolved
			}

			for _, studentID := range *linkedStudentIDs {
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
				`, userID, studentID, school)
				if err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func replaceAdminRoleTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
	role domain.Role,
) error {
	if _, err := tx.Exec(ctx,
		"DELETE FROM user_roles WHERE user_id::text = $1",
		userID,
	); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		INSERT INTO user_roles (user_id, role)
		SELECT id, $2
		FROM users
		WHERE id::text = $1
	`, userID, string(role))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func activeSchoolIDTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
) (string, error) {
	var schoolID string
	err := tx.QueryRow(ctx, `
		SELECT school_id::text
		FROM school_memberships
		WHERE user_id::text = $1
		  AND status = 'active'
		ORDER BY updated_at DESC, created_at DESC
		LIMIT 1
	`, userID).Scan(&schoolID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return schoolID, err
}
