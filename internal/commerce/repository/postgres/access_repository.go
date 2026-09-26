package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func scanAccessCode(row scanner) (commerce.AccessCode, error) {
	var c commerce.AccessCode
	err := row.Scan(&c.ID, &c.Code, &c.ProductID, &c.SchoolID, &c.Status, &c.MaxUses, &c.CurrentUses, &c.StartsAt, &c.ExpiresAt, &c.Revision, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return c, mapError(err)
	}
	return c, nil
}

const accessCodeSelect = `
SELECT id::text,code,product_id::text,COALESCE(school_id::text,''),status,max_uses,current_uses,starts_at,expires_at,revision,created_at,updated_at
FROM commerce_access_codes
`

func (r *Repository) ListAccessCodes(ctx context.Context, page, limit int) (commerce.AccessCodePage, error) {
	rows, err := r.db.Query(ctx, accessCodeSelect+` ORDER BY updated_at DESC,id DESC LIMIT $1 OFFSET $2`, limit+1, (page-1)*limit)
	if err != nil {
		return commerce.AccessCodePage{}, err
	}
	defer rows.Close()
	out := commerce.AccessCodePage{Page: page, Limit: limit}
	for rows.Next() {
		item, e := scanAccessCode(rows)
		if e != nil {
			return out, e
		}
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, nil
}

func (r *Repository) CreateAccessCode(ctx context.Context, actor string, in commerce.AccessCodeCreate) (commerce.AccessCode, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.AccessCode{}, err
	}
	defer tx.Rollback(ctx)
	var id string
	err = tx.QueryRow(ctx, `
INSERT INTO commerce_access_codes(code,product_id,school_id,max_uses,starts_at,expires_at,created_by)
SELECT $1,p.id,NULLIF($3,'')::uuid,$4,$5,$6,$7::uuid
FROM commerce_products p
JOIN commerce_packages pk ON pk.product_id=p.id
WHERE p.id=$2::uuid AND p.status='active' AND p.access_mode='paid'
RETURNING id::text
`, in.Code, in.ProductID, in.SchoolID, in.MaxUses, *in.StartsAt, in.ExpiresAt, actor).Scan(&id)
	if err != nil {
		return commerce.AccessCode{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "commerce.access_code.create", ResourceType: "commerce_access_code", ResourceID: id, Metadata: map[string]any{"productId": in.ProductID, "schoolId": in.SchoolID, "maxUses": in.MaxUses}}); err != nil {
		return commerce.AccessCode{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.AccessCode{}, err
	}
	return scanAccessCode(r.db.QueryRow(ctx, accessCodeSelect+` WHERE id=$1::uuid`, id))
}

func (r *Repository) UpdateAccessCodeStatus(ctx context.Context, actor, id string, expected int, status commerce.AccessCodeStatus) (commerce.AccessCode, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.AccessCode{}, err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `
UPDATE commerce_access_codes SET status=$3,revision=revision+1,updated_at=now()
WHERE id=$1::uuid AND revision=$2
`, id, expected, string(status))
	if err != nil {
		return commerce.AccessCode{}, mapError(err)
	}
	if tag.RowsAffected() == 0 {
		return commerce.AccessCode{}, commerce.ErrVersionConflict
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "commerce.access_code.status", ResourceType: "commerce_access_code", ResourceID: id, Metadata: map[string]any{"status": status, "revision": expected + 1}}); err != nil {
		return commerce.AccessCode{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.AccessCode{}, err
	}
	return scanAccessCode(r.db.QueryRow(ctx, accessCodeSelect+` WHERE id=$1::uuid`, id))
}

func (r *Repository) RedeemAccessCode(ctx context.Context, userID string, schoolIDs []string, code string) (commerce.AccessCodeRedemption, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.AccessCodeRedemption{}, err
	}
	defer tx.Rollback(ctx)

	var c commerce.AccessCode
	var packageID string
	var seatCapacity, validityDays *int
	err = tx.QueryRow(ctx, `
SELECT c.id::text,c.code,c.product_id::text,COALESCE(c.school_id::text,''),c.status,c.max_uses,c.current_uses,c.starts_at,c.expires_at,c.revision,c.created_at,c.updated_at,
       pk.id::text,pk.seat_capacity,pk.validity_days
FROM commerce_access_codes c
JOIN commerce_products p ON p.id=c.product_id
JOIN commerce_packages pk ON pk.product_id=p.id
WHERE c.code=$1 AND p.status='active' AND p.access_mode='paid'
FOR UPDATE OF c
`, code).Scan(&c.ID, &c.Code, &c.ProductID, &c.SchoolID, &c.Status, &c.MaxUses, &c.CurrentUses, &c.StartsAt, &c.ExpiresAt, &c.Revision, &c.CreatedAt, &c.UpdatedAt, &packageID, &seatCapacity, &validityDays)
	if err != nil {
		return commerce.AccessCodeRedemption{}, mapError(err)
	}

	var existingEntitlementID string
	err = tx.QueryRow(ctx, `SELECT entitlement_id::text FROM commerce_access_code_redemptions WHERE access_code_id=$1::uuid AND user_id=$2::uuid`, c.ID, userID).Scan(&existingEntitlementID)
	if err == nil {
		ent, e := scanEntitlement(tx.QueryRow(ctx, entitlementSelect+` WHERE id=$1::uuid`, existingEntitlementID))
		if e != nil {
			return commerce.AccessCodeRedemption{}, e
		}
		if e = tx.Commit(ctx); e != nil {
			return commerce.AccessCodeRedemption{}, e
		}
		return commerce.AccessCodeRedemption{AccessCode: c, Entitlement: ent}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return commerce.AccessCodeRedemption{}, err
	}

	now := time.Now().UTC()
	if c.Status != commerce.AccessCodeActive || now.Before(c.StartsAt) || !now.Before(c.ExpiresAt) || c.CurrentUses >= c.MaxUses {
		return commerce.AccessCodeRedemption{}, commerce.ErrConflict
	}
	if c.SchoolID != "" {
		member := false
		for _, id := range schoolIDs {
			if id == c.SchoolID {
				member = true
				break
			}
		}
		if !member {
			return commerce.AccessCodeRedemption{}, commerce.ErrConflict
		}
	}
	if seatCapacity != nil {
		var used int
		if err = tx.QueryRow(ctx, `
SELECT count(*) FROM commerce_entitlements
WHERE product_id=$1::uuid AND subject_type='user' AND status='active'
  AND starts_at<=now() AND (expires_at IS NULL OR expires_at>now())
`, c.ProductID).Scan(&used); err != nil {
			return commerce.AccessCodeRedemption{}, err
		}
		if used >= *seatCapacity {
			return commerce.AccessCodeRedemption{}, commerce.ErrConflict
		}
	}

	expiresAt := c.ExpiresAt
	if validityDays != nil {
		byValidity := now.AddDate(0, 0, *validityDays)
		if byValidity.Before(expiresAt) {
			expiresAt = byValidity
		}
	}
	idempotencyKey := "access_code:" + c.ID + ":" + userID
	var entitlementID string
	err = tx.QueryRow(ctx, `
INSERT INTO commerce_entitlements(subject_type,user_id,product_id,source_type,source_id,status,starts_at,expires_at,idempotency_key,metadata)
VALUES('user',$1::uuid,$2::uuid,'access_code',$3,'active',now(),$4,$5,jsonb_build_object('accessCodeId',$6,'accessCode',$7))
RETURNING id::text
`, userID, c.ProductID, c.ID+":"+userID, expiresAt, idempotencyKey, c.ID, c.Code).Scan(&entitlementID)
	if err != nil {
		return commerce.AccessCodeRedemption{}, mapError(err)
	}
	if _, err = tx.Exec(ctx, `
INSERT INTO commerce_access_code_redemptions(access_code_id,user_id,entitlement_id)
VALUES($1::uuid,$2::uuid,$3::uuid)
`, c.ID, userID, entitlementID); err != nil {
		return commerce.AccessCodeRedemption{}, mapError(err)
	}
	if _, err = tx.Exec(ctx, `UPDATE commerce_access_codes SET current_uses=current_uses+1,updated_at=now() WHERE id=$1::uuid`, c.ID); err != nil {
		return commerce.AccessCodeRedemption{}, err
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: userID, Action: "commerce.access_code.redeem", ResourceType: "commerce_access_code", ResourceID: c.ID, Metadata: map[string]any{"productId": c.ProductID, "entitlementId": entitlementID}}); err != nil {
		return commerce.AccessCodeRedemption{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.AccessCodeRedemption{}, err
	}
	c.CurrentUses++
	c.UpdatedAt = now
	ent, err := scanEntitlement(r.db.QueryRow(ctx, entitlementSelect+` WHERE id=$1::uuid`, entitlementID))
	if err != nil {
		return commerce.AccessCodeRedemption{}, err
	}
	return commerce.AccessCodeRedemption{AccessCode: c, Entitlement: ent}, nil
}

func scanSchoolSeat(row scanner) (commerce.SchoolSeatAssignment, error) {
	var s commerce.SchoolSeatAssignment
	err := row.Scan(&s.ID, &s.SchoolEntitlementID, &s.UserID, &s.UserEntitlementID, &s.Status, &s.Revision, &s.RevokedAt, &s.RevokeReason, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return s, mapError(err)
	}
	return s, nil
}

const schoolSeatSelect = `
SELECT id::text,school_entitlement_id::text,user_id::text,user_entitlement_id::text,status,revision,revoked_at,revoke_reason,created_at,updated_at
FROM commerce_school_seat_assignments
`

func (r *Repository) ListSchoolSeats(ctx context.Context, schoolEntitlementID string, page, limit int) (commerce.SchoolSeatPage, error) {
	rows, err := r.db.Query(ctx, schoolSeatSelect+` WHERE school_entitlement_id=$1::uuid ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, schoolEntitlementID, limit+1, (page-1)*limit)
	if err != nil {
		return commerce.SchoolSeatPage{}, err
	}
	defer rows.Close()
	out := commerce.SchoolSeatPage{Page: page, Limit: limit}
	for rows.Next() {
		item, e := scanSchoolSeat(rows)
		if e != nil {
			return out, e
		}
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, nil
}

func (r *Repository) AssignSchoolSeat(ctx context.Context, actor, schoolEntitlementID, userID string, userSchoolIDs []string) (commerce.SchoolSeatAssignment, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.SchoolSeatAssignment{}, err
	}
	defer tx.Rollback(ctx)

	var schoolID, productID string
	var seatCapacity *int
	var schoolExpires *time.Time
	err = tx.QueryRow(ctx, `
SELECT e.school_id::text,e.product_id::text,pk.seat_capacity,e.expires_at
FROM commerce_entitlements e
JOIN commerce_products p ON p.id=e.product_id
JOIN commerce_packages pk ON pk.product_id=p.id
WHERE e.id=$1::uuid AND e.subject_type='school' AND e.status='active'
  AND e.starts_at<=now() AND (e.expires_at IS NULL OR e.expires_at>now())
  AND p.status='active'
FOR UPDATE OF e
`, schoolEntitlementID).Scan(&schoolID, &productID, &seatCapacity, &schoolExpires)
	if err != nil {
		return commerce.SchoolSeatAssignment{}, mapError(err)
	}
	if seatCapacity == nil {
		return commerce.SchoolSeatAssignment{}, commerce.ErrConflict
	}
	member := false
	for _, id := range userSchoolIDs {
		if id == schoolID {
			member = true
			break
		}
	}
	if !member {
		return commerce.SchoolSeatAssignment{}, commerce.ErrConflict
	}

	var existingID string
	err = tx.QueryRow(ctx, `
SELECT id::text FROM commerce_school_seat_assignments
WHERE school_entitlement_id=$1::uuid AND user_id=$2::uuid AND status='active'
`, schoolEntitlementID, userID).Scan(&existingID)
	if err == nil {
		out, e := scanSchoolSeat(tx.QueryRow(ctx, schoolSeatSelect+` WHERE id=$1::uuid`, existingID))
		if e != nil {
			return commerce.SchoolSeatAssignment{}, e
		}
		if e = tx.Commit(ctx); e != nil {
			return commerce.SchoolSeatAssignment{}, e
		}
		return out, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return commerce.SchoolSeatAssignment{}, err
	}

	var used int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM commerce_school_seat_assignments WHERE school_entitlement_id=$1::uuid AND status='active'`, schoolEntitlementID).Scan(&used); err != nil {
		return commerce.SchoolSeatAssignment{}, err
	}
	if used >= *seatCapacity {
		return commerce.SchoolSeatAssignment{}, commerce.ErrConflict
	}

	var seatID string
	if err = tx.QueryRow(ctx, `SELECT uuidv7()::text`).Scan(&seatID); err != nil {
		return commerce.SchoolSeatAssignment{}, err
	}
	var userEntitlementID string
	idempotencyKey := "school_seat:" + seatID
	err = tx.QueryRow(ctx, `
INSERT INTO commerce_entitlements(subject_type,user_id,product_id,source_type,source_id,status,granted_by_user_id,starts_at,expires_at,idempotency_key,metadata)
VALUES('user',$1::uuid,$2::uuid,'school_contract',$3,'active',$4::uuid,now(),$5,$6,jsonb_build_object('schoolEntitlementId',$7,'schoolId',$8))
RETURNING id::text
`, userID, productID, seatID, actor, schoolExpires, idempotencyKey, schoolEntitlementID, schoolID).Scan(&userEntitlementID)
	if err != nil {
		return commerce.SchoolSeatAssignment{}, mapError(err)
	}
	if _, err = tx.Exec(ctx, `
INSERT INTO commerce_school_seat_assignments(id,school_entitlement_id,user_id,user_entitlement_id,assigned_by)
VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid)
`, seatID, schoolEntitlementID, userID, userEntitlementID, actor); err != nil {
		return commerce.SchoolSeatAssignment{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "commerce.school_seat.assign", ResourceType: "commerce_school_seat", ResourceID: seatID, Metadata: map[string]any{"schoolEntitlementId": schoolEntitlementID, "userId": userID, "userEntitlementId": userEntitlementID}}); err != nil {
		return commerce.SchoolSeatAssignment{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.SchoolSeatAssignment{}, err
	}
	return scanSchoolSeat(r.db.QueryRow(ctx, schoolSeatSelect+` WHERE id=$1::uuid`, seatID))
}

func (r *Repository) RevokeSchoolSeat(ctx context.Context, actor, id string, expected int, reason string) (commerce.SchoolSeatAssignment, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.SchoolSeatAssignment{}, err
	}
	defer tx.Rollback(ctx)
	var entitlementID string
	err = tx.QueryRow(ctx, `
SELECT user_entitlement_id::text FROM commerce_school_seat_assignments
WHERE id=$1::uuid AND revision=$2 AND status='active'
FOR UPDATE
`, id, expected).Scan(&entitlementID)
	if errors.Is(err, pgx.ErrNoRows) {
		return commerce.SchoolSeatAssignment{}, commerce.ErrVersionConflict
	}
	if err != nil {
		return commerce.SchoolSeatAssignment{}, err
	}
	if _, err = tx.Exec(ctx, `
UPDATE commerce_school_seat_assignments
SET status='revoked',revoked_by=$2::uuid,revoked_at=now(),revoke_reason=$3,revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, id, actor, reason); err != nil {
		return commerce.SchoolSeatAssignment{}, mapError(err)
	}
	if _, err = tx.Exec(ctx, `
UPDATE commerce_entitlements
SET status='revoked',revoked_at=now(),revoked_by_user_id=$2::uuid,revoke_reason=$3,revision=revision+1,updated_at=now()
WHERE id=$1::uuid AND status='active'
`, entitlementID, actor, reason); err != nil {
		return commerce.SchoolSeatAssignment{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "commerce.school_seat.revoke", ResourceType: "commerce_school_seat", ResourceID: id, Metadata: map[string]any{"reason": reason, "userEntitlementId": entitlementID}}); err != nil {
		return commerce.SchoolSeatAssignment{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.SchoolSeatAssignment{}, err
	}
	return scanSchoolSeat(r.db.QueryRow(ctx, schoolSeatSelect+` WHERE id=$1::uuid`, id))
}
