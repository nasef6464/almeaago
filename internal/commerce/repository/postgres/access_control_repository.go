package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type accessCodeScanner interface{ Scan(...any) error }

const accessCodeSelect = `
SELECT id::text,code,school_id::text,product_id::text,status,max_uses,current_uses,starts_at,expires_at,revision,created_at,updated_at
FROM commerce_access_codes
`

func scanAccessCode(row accessCodeScanner) (commerce.AccessCode, error) {
	var code commerce.AccessCode
	if err := row.Scan(
		&code.ID, &code.Code, &code.SchoolID, &code.ProductID, &code.Status,
		&code.MaxUses, &code.CurrentUses, &code.StartsAt, &code.ExpiresAt,
		&code.Revision, &code.CreatedAt, &code.UpdatedAt,
	); err != nil {
		return code, mapError(err)
	}
	return code, nil
}

func (r *Repository) ListAccessCodes(ctx context.Context, page, limit int, schoolID, productID string, status commerce.AccessCodeStatus) (commerce.AccessCodePage, error) {
	rows, err := r.db.Query(ctx, accessCodeSelect+`
WHERE ($1='' OR school_id::text=$1)
  AND ($2='' OR product_id::text=$2)
  AND ($3='' OR status=$3)
ORDER BY created_at DESC,id DESC
LIMIT $4 OFFSET $5
`, schoolID, productID, string(status), limit+1, (page-1)*limit)
	if err != nil {
		return commerce.AccessCodePage{}, err
	}
	defer rows.Close()
	out := commerce.AccessCodePage{Page: page, Limit: limit}
	for rows.Next() {
		code, scanErr := scanAccessCode(rows)
		if scanErr != nil {
			return out, scanErr
		}
		out.Items = append(out.Items, code)
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

func (r *Repository) CreateAccessCode(ctx context.Context, actor string, in commerce.AccessCodeWrite) (commerce.AccessCode, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.AccessCode{}, err
	}
	defer tx.Rollback(ctx)
	var id string
	err = tx.QueryRow(ctx, `
INSERT INTO commerce_access_codes(code,school_id,product_id,status,max_uses,starts_at,expires_at,created_by)
VALUES($1,$2::uuid,$3::uuid,'active',$4,$5,$6,$7::uuid)
RETURNING id::text
`, in.Code, in.SchoolID, in.ProductID, in.MaxUses, in.StartsAt, in.ExpiresAt, actor).Scan(&id)
	if err != nil {
		return commerce.AccessCode{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: actor,
		Action:       "commerce.access_code.create",
		ResourceType: "commerce_access_code",
		ResourceID:   id,
		Metadata: map[string]any{
			"schoolId": in.SchoolID, "productId": in.ProductID, "maxUses": in.MaxUses,
		},
	}); err != nil {
		return commerce.AccessCode{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.AccessCode{}, err
	}
	return scanAccessCode(r.db.QueryRow(ctx, accessCodeSelect+` WHERE id=$1::uuid`, id))
}

func (r *Repository) UpdateAccessCode(ctx context.Context, actor, id string, in commerce.AccessCodeUpdate) (commerce.AccessCode, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.AccessCode{}, err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `
UPDATE commerce_access_codes
SET status=$3,max_uses=$4,expires_at=$5,revision=revision+1,updated_at=now()
WHERE id=$1::uuid AND revision=$2 AND current_uses<=$4
`, id, in.ExpectedRevision, string(in.Status), in.MaxUses, in.ExpiresAt)
	if err != nil {
		return commerce.AccessCode{}, mapError(err)
	}
	if tag.RowsAffected() == 0 {
		return commerce.AccessCode{}, commerce.ErrVersionConflict
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: actor,
		Action:       "commerce.access_code.update",
		ResourceType: "commerce_access_code",
		ResourceID:   id,
		Metadata: map[string]any{
			"status": in.Status, "maxUses": in.MaxUses, "revision": in.ExpectedRevision + 1,
		},
	}); err != nil {
		return commerce.AccessCode{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.AccessCode{}, err
	}
	return scanAccessCode(r.db.QueryRow(ctx, accessCodeSelect+` WHERE id=$1::uuid`, id))
}

type schoolSeatScanner interface{ Scan(...any) error }

const schoolSeatSelect = `
SELECT id::text,school_id::text,product_id::text,user_id::text,entitlement_id::text,source_type,source_id,idempotency_key,
       COALESCE(assigned_by_user_id::text,''),created_at
FROM commerce_school_seats
`

func scanSchoolSeat(row schoolSeatScanner) (commerce.SchoolSeat, error) {
	var seat commerce.SchoolSeat
	if err := row.Scan(
		&seat.ID, &seat.SchoolID, &seat.ProductID, &seat.UserID, &seat.EntitlementID,
		&seat.SourceType, &seat.SourceID, &seat.IdempotencyKey, &seat.AssignedBy, &seat.CreatedAt,
	); err != nil {
		return seat, mapError(err)
	}
	return seat, nil
}

func (r *Repository) ListSchoolSeats(ctx context.Context, page, limit int, schoolID, productID, userID string) (commerce.SchoolSeatPage, error) {
	rows, err := r.db.Query(ctx, schoolSeatSelect+`
WHERE ($1='' OR school_id::text=$1)
  AND ($2='' OR product_id::text=$2)
  AND ($3='' OR user_id::text=$3)
ORDER BY created_at DESC,id DESC
LIMIT $4 OFFSET $5
`, schoolID, productID, userID, limit+1, (page-1)*limit)
	if err != nil {
		return commerce.SchoolSeatPage{}, err
	}
	defer rows.Close()
	out := commerce.SchoolSeatPage{Page: page, Limit: limit}
	for rows.Next() {
		seat, scanErr := scanSchoolSeat(rows)
		if scanErr != nil {
			return out, scanErr
		}
		out.Items = append(out.Items, seat)
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

func containsSchoolID(ids []string, wanted string) bool {
	for _, id := range ids {
		if id == wanted {
			return true
		}
	}
	return false
}

func schoolPackageStateTx(ctx context.Context, tx pgx.Tx, productID string) (*int, *int, error) {
	var productType commerce.ProductType
	var productStatus commerce.ProductStatus
	var visible bool
	var packageKind commerce.PackageKind
	var seatCapacity, validityDays *int
	err := tx.QueryRow(ctx, `
SELECT p.product_type,p.status,p.is_visible,pk.package_kind,pk.seat_capacity,pk.validity_days
FROM commerce_products p
JOIN commerce_packages pk ON pk.product_id=p.id
WHERE p.id=$1::uuid
FOR UPDATE OF p,pk
`, productID).Scan(&productType, &productStatus, &visible, &packageKind, &seatCapacity, &validityDays)
	if err != nil {
		return nil, nil, mapError(err)
	}
	if productType != commerce.ProductPackage || productStatus != commerce.ProductActive || !visible || packageKind != commerce.PackageSchool {
		return nil, nil, commerce.ErrConflict
	}
	return seatCapacity, validityDays, nil
}

func activeSeatCountTx(ctx context.Context, tx pgx.Tx, schoolID, productID string) (int, error) {
	var count int
	err := tx.QueryRow(ctx, `
SELECT count(*)
FROM commerce_school_seats s
JOIN commerce_entitlements e ON e.id=s.entitlement_id
WHERE s.school_id=$1::uuid AND s.product_id=$2::uuid
  AND e.status='active' AND e.starts_at<=now() AND (e.expires_at IS NULL OR e.expires_at>now())
`, schoolID, productID).Scan(&count)
	return count, err
}

func boundedSeatExpiry(now time.Time, validityDays *int, explicit *time.Time) *time.Time {
	var expires *time.Time
	if validityDays != nil {
		value := now.Add(time.Duration(*validityDays) * 24 * time.Hour)
		expires = &value
	}
	if explicit != nil && (expires == nil || explicit.Before(*expires)) {
		value := explicit.UTC()
		expires = &value
	}
	return expires
}

func (r *Repository) createSchoolSeatTx(
	ctx context.Context,
	tx pgx.Tx,
	actor, schoolID, productID, userID, sourceType, sourceID, idempotencyKey, entitlementSource string,
	explicitExpires *time.Time,
	seatCapacity, validityDays *int,
) (commerce.SchoolSeat, commerce.Entitlement, error) {
	var existingSeatID, existingEntitlementID string
	err := tx.QueryRow(ctx, `
SELECT id::text,entitlement_id::text
FROM commerce_school_seats
WHERE school_id=$1::uuid AND product_id=$2::uuid AND user_id=$3::uuid
`, schoolID, productID, userID).Scan(&existingSeatID, &existingEntitlementID)
	if err == nil {
		seat, seatErr := scanSchoolSeat(tx.QueryRow(ctx, schoolSeatSelect+` WHERE id=$1::uuid`, existingSeatID))
		if seatErr != nil {
			return commerce.SchoolSeat{}, commerce.Entitlement{}, seatErr
		}
		entitlement, entitlementErr := scanEntitlement(tx.QueryRow(ctx, entitlementSelect+` WHERE id=$1::uuid`, existingEntitlementID))
		if entitlementErr != nil {
			return commerce.SchoolSeat{}, commerce.Entitlement{}, entitlementErr
		}
		if seat.IdempotencyKey == idempotencyKey {
			return seat, entitlement, nil
		}
		return commerce.SchoolSeat{}, commerce.Entitlement{}, commerce.ErrConflict
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, err
	}

	if seatCapacity != nil {
		count, countErr := activeSeatCountTx(ctx, tx, schoolID, productID)
		if countErr != nil {
			return commerce.SchoolSeat{}, commerce.Entitlement{}, countErr
		}
		if count >= *seatCapacity {
			return commerce.SchoolSeat{}, commerce.Entitlement{}, commerce.ErrConflict
		}
	}

	now := time.Now().UTC()
	expiresAt := boundedSeatExpiry(now, validityDays, explicitExpires)
	var entitlementID string
	err = tx.QueryRow(ctx, `
INSERT INTO commerce_entitlements(
  subject_type,user_id,product_id,source_type,source_id,status,granted_by_user_id,starts_at,expires_at,idempotency_key,metadata
) VALUES(
  'user',$1::uuid,$2::uuid,$3,$4,'active',NULLIF($5,'')::uuid,$6,$7,$8,
  jsonb_build_object('schoolId',$9,'seatSource',$10)
)
ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
RETURNING id::text
`, userID, productID, entitlementSource, sourceID, actor, now, expiresAt, idempotencyKey, schoolID, sourceType).Scan(&entitlementID)
	if err != nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, mapError(err)
	}

	var seatID string
	err = tx.QueryRow(ctx, `
INSERT INTO commerce_school_seats(
  school_id,product_id,user_id,entitlement_id,source_type,source_id,idempotency_key,assigned_by_user_id
) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,NULLIF($8,'')::uuid)
RETURNING id::text
`, schoolID, productID, userID, entitlementID, sourceType, sourceID, idempotencyKey, actor).Scan(&seatID)
	if err != nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, mapError(err)
	}
	seat, err := scanSchoolSeat(tx.QueryRow(ctx, schoolSeatSelect+` WHERE id=$1::uuid`, seatID))
	if err != nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, err
	}
	entitlement, err := scanEntitlement(tx.QueryRow(ctx, entitlementSelect+` WHERE id=$1::uuid`, entitlementID))
	if err != nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, err
	}
	return seat, entitlement, nil
}

func (r *Repository) RedeemAccessCode(ctx context.Context, userID, code string, eligibleSchoolIDs []string) (commerce.AccessCodeRedemption, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.AccessCodeRedemption{}, err
	}
	defer tx.Rollback(ctx)

	accessCode, err := scanAccessCode(tx.QueryRow(ctx, accessCodeSelect+` WHERE code=$1 FOR UPDATE`, code))
	if err != nil {
		return commerce.AccessCodeRedemption{}, err
	}
	now := time.Now().UTC()
	if accessCode.Status != commerce.AccessCodeActive ||
		(accessCode.StartsAt != nil && accessCode.StartsAt.After(now)) ||
		!accessCode.ExpiresAt.After(now) ||
		!containsSchoolID(eligibleSchoolIDs, accessCode.SchoolID) {
		return commerce.AccessCodeRedemption{}, commerce.ErrConflict
	}

	var existingSeatID, existingEntitlementID string
	err = tx.QueryRow(ctx, `
SELECT seat_id::text,entitlement_id::text
FROM commerce_access_code_redemptions
WHERE access_code_id=$1::uuid AND user_id=$2::uuid
`, accessCode.ID, userID).Scan(&existingSeatID, &existingEntitlementID)
	if err == nil {
		seat, seatErr := scanSchoolSeat(tx.QueryRow(ctx, schoolSeatSelect+` WHERE id=$1::uuid`, existingSeatID))
		if seatErr != nil {
			return commerce.AccessCodeRedemption{}, seatErr
		}
		entitlement, entitlementErr := scanEntitlement(tx.QueryRow(ctx, entitlementSelect+` WHERE id=$1::uuid`, existingEntitlementID))
		if entitlementErr != nil {
			return commerce.AccessCodeRedemption{}, entitlementErr
		}
		return commerce.AccessCodeRedemption{AccessCode: accessCode, SchoolSeat: seat, Entitlement: entitlement, Duplicate: true}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return commerce.AccessCodeRedemption{}, err
	}
	if accessCode.CurrentUses >= accessCode.MaxUses {
		return commerce.AccessCodeRedemption{}, commerce.ErrConflict
	}

	seatCapacity, validityDays, err := schoolPackageStateTx(ctx, tx, accessCode.ProductID)
	if err != nil {
		return commerce.AccessCodeRedemption{}, err
	}
	expiresAt := accessCode.ExpiresAt
	idempotencyKey := "access_code:" + accessCode.ID + ":" + userID
	seat, entitlement, err := r.createSchoolSeatTx(
		ctx, tx, "", accessCode.SchoolID, accessCode.ProductID, userID,
		"access_code", accessCode.ID, idempotencyKey, "access_code", &expiresAt, seatCapacity, validityDays,
	)
	if err != nil {
		return commerce.AccessCodeRedemption{}, err
	}

	_, err = tx.Exec(ctx, `
INSERT INTO commerce_access_code_redemptions(access_code_id,user_id,school_id,product_id,seat_id,entitlement_id)
VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid)
`, accessCode.ID, userID, accessCode.SchoolID, accessCode.ProductID, seat.ID, entitlement.ID)
	if err != nil {
		return commerce.AccessCodeRedemption{}, mapError(err)
	}
	tag, err := tx.Exec(ctx, `
UPDATE commerce_access_codes
SET current_uses=current_uses+1,revision=revision+1,updated_at=now()
WHERE id=$1::uuid AND current_uses<max_uses
`, accessCode.ID)
	if err != nil {
		return commerce.AccessCodeRedemption{}, mapError(err)
	}
	if tag.RowsAffected() == 0 {
		return commerce.AccessCodeRedemption{}, commerce.ErrConflict
	}
	accessCode.CurrentUses++
	accessCode.Revision++
	accessCode.UpdatedAt = now

	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: userID,
		Action:       "commerce.access_code.redeem",
		ResourceType: "commerce_access_code",
		ResourceID:   accessCode.ID,
		Metadata: map[string]any{
			"schoolId": accessCode.SchoolID, "productId": accessCode.ProductID,
			"seatId": seat.ID, "entitlementId": entitlement.ID,
		},
	}); err != nil {
		return commerce.AccessCodeRedemption{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.AccessCodeRedemption{}, err
	}
	return commerce.AccessCodeRedemption{AccessCode: accessCode, SchoolSeat: seat, Entitlement: entitlement}, nil
}

func (r *Repository) AssignSchoolSeat(ctx context.Context, actor string, in commerce.SchoolSeatAssign) (commerce.SchoolSeat, commerce.Entitlement, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, err
	}
	defer tx.Rollback(ctx)

	seatCapacity, validityDays, err := schoolPackageStateTx(ctx, tx, in.ProductID)
	if err != nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, err
	}
	key := "school_seat:" + in.IdempotencyKey
	seat, entitlement, err := r.createSchoolSeatTx(
		ctx, tx, actor, in.SchoolID, in.ProductID, in.UserID,
		"admin_assignment", in.IdempotencyKey, key, "school_contract", in.ExpiresAt, seatCapacity, validityDays,
	)
	if err != nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, err
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: actor,
		Action:       "commerce.school_seat.assign",
		ResourceType: "commerce_school_seat",
		ResourceID:   seat.ID,
		Metadata: map[string]any{
			"schoolId": in.SchoolID, "productId": in.ProductID, "userId": in.UserID,
			"entitlementId": entitlement.ID,
		},
	}); err != nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, err
	}
	return seat, entitlement, nil
}
