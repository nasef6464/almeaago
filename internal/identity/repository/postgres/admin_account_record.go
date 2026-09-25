package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/nasef6464/almeaago/internal/identity/domain"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

var errOrganizationScopeGatewayUnavailable = errors.New("organization scope gateway is not configured")

func (r *Repository) syncOrganizationScopesTx(
	ctx context.Context,
	tx pgx.Tx,
	command orgdomain.AdminAccountScopeCommand,
) error {
	if r.orgScopes == nil {
		return errOrganizationScopeGatewayUnavailable
	}
	return r.orgScopes.SyncTx(ctx, tx, command)
}

func (r *Repository) adminUserRecordTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
) (domain.AdminUserRecord, error) {
	var record domain.AdminUserRecord
	var roleStrings []string

	err := tx.QueryRow(ctx, `
		SELECT
			u.id::text,
			COALESCE(u.email, ''),
			u.name,
			u.status,
			u.avatar_url,
			COALESCE(u.national_id, ''),
			COALESCE(u.phone, ''),
			(u.email_verified_at IS NOT NULL),
			u.created_at,
			u.updated_at,
			ARRAY(
				SELECT ur.role
				FROM user_roles ur
				WHERE ur.user_id = u.id
				ORDER BY ur.role
			)::text[]
		FROM users u
		WHERE u.id = $1::uuid
	`, userID).Scan(
		&record.User.ID,
		&record.User.Email,
		&record.User.Name,
		&record.User.Status,
		&record.User.AvatarURL,
		&record.User.NationalID,
		&record.User.Phone,
		&record.User.EmailVerified,
		&record.User.CreatedAt,
		&record.User.UpdatedAt,
		&roleStrings,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AdminUserRecord{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.AdminUserRecord{}, err
	}

	record.User.Roles = make([]domain.Role, 0, len(roleStrings))
	for _, value := range roleStrings {
		record.User.Roles = append(record.User.Roles, domain.Role(value))
	}

	if r.orgScopes == nil {
		return domain.AdminUserRecord{}, errOrganizationScopeGatewayUnavailable
	}
	snapshot, err := r.orgScopes.SnapshotTx(ctx, tx, userID)
	if errors.Is(err, orgdomain.ErrScopeNotFound) {
		return domain.AdminUserRecord{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.AdminUserRecord{}, err
	}

	record.SchoolID = snapshot.SchoolID
	record.ClassIDs = snapshot.ClassIDs
	record.LinkedStudentIDs = snapshot.LinkedStudentIDs
	return record, nil
}

func replaceAdminRoleTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
	role domain.Role,
) error {
	if _, err := tx.Exec(ctx,
		"DELETE FROM user_roles WHERE user_id = $1::uuid",
		userID,
	); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		INSERT INTO user_roles (user_id, role)
		SELECT id, $2
		FROM users
		WHERE id = $1::uuid
	`, userID, string(role))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
