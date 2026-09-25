package postgres

import (
	"context"
	"errors"
	"strconv"

	"github.com/jackc/pgx/v5"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) UpsertMembership(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	write org.MembershipWrite,
) (org.SchoolMembership, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.SchoolMembership{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const query = "INSERT INTO school_memberships (school_id, user_id, role, status) " +
		"SELECT s.id, u.id, $3, $4 " +
		"FROM schools s JOIN users u ON u.id = $2::uuid " +
		"WHERE s.id = $1::uuid AND s.status <> 'archived' " +
		"AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = $3) " +
		"ON CONFLICT (school_id, user_id, role) DO UPDATE SET status = EXCLUDED.status, updated_at = now() " +
		"RETURNING id::text, school_id::text, user_id::text, role, status, created_at, updated_at"

	var membership org.SchoolMembership
	err = tx.QueryRow(
		ctx,
		query,
		schoolID,
		write.UserID,
		string(write.Role),
		string(write.Status),
	).Scan(
		&membership.ID,
		&membership.SchoolID,
		&membership.UserID,
		&membership.Role,
		&membership.Status,
		&membership.CreatedAt,
		&membership.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return org.SchoolMembership{}, org.ErrNotFound
	}
	if err != nil {
		return org.SchoolMembership{}, err
	}
	membership.Permissions = []string{}

	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "organizations.membership.upsert",
		ResourceType: "school_membership",
		ResourceID:   membership.ID,
		Metadata: map[string]any{
			"schoolId": membership.SchoolID,
			"userId":   membership.UserID,
			"role":     membership.Role,
			"status":   membership.Status,
		},
	}); err != nil {
		return org.SchoolMembership{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return org.SchoolMembership{}, err
	}
	return membership, nil
}

func (r *Repository) ListDirectors(
	ctx context.Context,
	schoolID string,
	query org.DirectorQuery,
) (org.DirectorPage, error) {
	args := []any{schoolID}
	where := " WHERE sm.school_id = $1::uuid AND sm.role = 'school_admin'"
	if query.Status != nil {
		args = append(args, string(*query.Status))
		where += " AND sm.status = $" + strconv.Itoa(len(args))
	}

	var total int
	if err := r.db.QueryRow(
		ctx,
		"SELECT count(*)::int FROM school_memberships sm"+where,
		args...,
	).Scan(&total); err != nil {
		return org.DirectorPage{}, err
	}

	limitParam := len(args) + 1
	offsetParam := len(args) + 2
	listArgs := append(append([]any{}, args...), query.Limit, (query.Page-1)*query.Limit)
	rows, err := r.db.Query(
		ctx,
		directorSelect+where+
			" ORDER BY sm.updated_at DESC, sm.id DESC"+
			" LIMIT $"+strconv.Itoa(limitParam)+
			" OFFSET $"+strconv.Itoa(offsetParam),
		listArgs...,
	)
	if err != nil {
		return org.DirectorPage{}, err
	}
	defer rows.Close()

	directors := make([]org.DirectorRecord, 0, query.Limit)
	for rows.Next() {
		record, err := scanDirectorRecord(rows)
		if err != nil {
			return org.DirectorPage{}, err
		}
		directors = append(directors, record)
	}
	if err := rows.Err(); err != nil {
		return org.DirectorPage{}, err
	}
	return org.DirectorPage{
		Directors: directors,
		Page:      query.Page,
		Limit:     query.Limit,
		Total:     total,
	}, nil
}

func (r *Repository) UpsertDirector(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	write org.DirectorWrite,
) (org.DirectorRecord, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.DirectorRecord{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const membershipSQL = "INSERT INTO school_memberships (school_id, user_id, role, status) " +
		"SELECT s.id, u.id, 'school_admin', $3 " +
		"FROM schools s JOIN users u ON u.id = $2::uuid " +
		"WHERE s.id = $1::uuid AND s.status <> 'archived' " +
		"AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'school_admin') " +
		"ON CONFLICT (school_id, user_id, role) DO UPDATE SET status = EXCLUDED.status, updated_at = now() " +
		"RETURNING id::text"

	var membershipID string
	err = tx.QueryRow(ctx, membershipSQL, schoolID, write.UserID, string(write.Status)).Scan(&membershipID)
	if errors.Is(err, pgx.ErrNoRows) {
		return org.DirectorRecord{}, org.ErrNotFound
	}
	if err != nil {
		return org.DirectorRecord{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"DELETE FROM school_membership_permissions WHERE membership_id = $1::uuid",
		membershipID,
	); err != nil {
		return org.DirectorRecord{}, err
	}

	for _, permission := range write.Permissions {
		if _, err := tx.Exec(
			ctx,
			"INSERT INTO school_membership_permissions (membership_id, permission) "+
				"VALUES ($1::uuid, $2) ON CONFLICT DO NOTHING",
			membershipID,
			permission,
		); err != nil {
			return org.DirectorRecord{}, err
		}
	}

	record, err := scanDirectorRecord(tx.QueryRow(
		ctx,
		directorSelect+" WHERE sm.id = $1::uuid",
		membershipID,
	))
	if err != nil {
		return org.DirectorRecord{}, err
	}

	action := "organizations.director.grant"
	if write.Status != org.MembershipStatusActive {
		action = "organizations.director.revoke"
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       action,
		ResourceType: "school_membership",
		ResourceID:   membershipID,
		Metadata: map[string]any{
			"schoolId":    schoolID,
			"userId":      write.UserID,
			"status":      write.Status,
			"permissions": write.Permissions,
		},
	}); err != nil {
		return org.DirectorRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return org.DirectorRecord{}, err
	}
	return record, nil
}

const directorSelect = " SELECT " +
	"sm.id::text, sm.school_id::text, sm.user_id::text, sm.role, sm.status, " +
	"ARRAY(SELECT p.permission FROM school_membership_permissions p " +
	"WHERE p.membership_id = sm.id ORDER BY p.permission)::text[], " +
	"sm.created_at, sm.updated_at, u.name, COALESCE(u.email, ''), u.status " +
	"FROM school_memberships sm JOIN users u ON u.id = sm.user_id"

func scanDirectorRecord(row rowScanner) (org.DirectorRecord, error) {
	var record org.DirectorRecord
	err := row.Scan(
		&record.Membership.ID,
		&record.Membership.SchoolID,
		&record.Membership.UserID,
		&record.Membership.Role,
		&record.Membership.Status,
		&record.Membership.Permissions,
		&record.Membership.CreatedAt,
		&record.Membership.UpdatedAt,
		&record.UserName,
		&record.UserEmail,
		&record.UserStatus,
	)
	if err != nil {
		return org.DirectorRecord{}, err
	}
	if record.Membership.Permissions == nil {
		record.Membership.Permissions = []string{}
	}
	return record, nil
}
