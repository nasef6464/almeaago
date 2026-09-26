package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type discountScanner interface{ Scan(...any) error }

const discountSelect = `
SELECT id::text,code,label,discount_type,percentage_bps,fixed_minor,status,min_amount_minor,
       max_redemptions,reserved_count,redeemed_count,starts_at,expires_at,revision,created_at,updated_at
FROM commerce_discount_codes
`

func scanDiscount(row discountScanner) (commerce.DiscountCode, error) {
	var d commerce.DiscountCode
	err := row.Scan(
		&d.ID, &d.Code, &d.Label, &d.DiscountType, &d.PercentageBPS, &d.FixedMinor, &d.Status,
		&d.MinAmountMinor, &d.MaxRedemptions, &d.ReservedCount, &d.RedeemedCount,
		&d.StartsAt, &d.ExpiresAt, &d.Revision, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return d, mapError(err)
	}
	return d, nil
}

func (r *Repository) loadDiscountScopes(ctx context.Context, ids []string, byID map[string]*commerce.DiscountCode) error {
	if len(ids) == 0 {
		return nil
	}
	rows, err := r.db.Query(ctx, `
SELECT discount_id::text,scope_type,COALESCE(product_id::text,''),COALESCE(product_type,'')
FROM commerce_discount_scopes
WHERE discount_id::text=ANY($1::text[])
ORDER BY discount_id,scope_type,product_id,product_type
`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var scope commerce.DiscountScope
		if err = rows.Scan(&id, &scope.ScopeType, &scope.ProductID, &scope.ProductType); err != nil {
			return err
		}
		if target := byID[id]; target != nil {
			target.Scopes = append(target.Scopes, scope)
		}
	}
	return rows.Err()
}

func (r *Repository) getDiscount(ctx context.Context, id string) (commerce.DiscountCode, error) {
	d, err := scanDiscount(r.db.QueryRow(ctx, discountSelect+` WHERE id=$1::uuid`, id))
	if err != nil {
		return d, err
	}
	byID := map[string]*commerce.DiscountCode{d.ID: &d}
	if err = r.loadDiscountScopes(ctx, []string{d.ID}, byID); err != nil {
		return commerce.DiscountCode{}, err
	}
	return d, nil
}

func (r *Repository) ListDiscounts(ctx context.Context, page, limit int, status commerce.DiscountStatus, search string) (commerce.DiscountPage, error) {
	rows, err := r.db.Query(ctx, discountSelect+`
WHERE ($1='' OR status=$1)
  AND ($2='' OR code ILIKE '%'||$2||'%' OR label ILIKE '%'||$2||'%')
ORDER BY updated_at DESC,id DESC
LIMIT $3 OFFSET $4
`, string(status), search, limit+1, (page-1)*limit)
	if err != nil {
		return commerce.DiscountPage{}, err
	}
	defer rows.Close()
	out := commerce.DiscountPage{Page: page, Limit: limit}
	for rows.Next() {
		d, scanErr := scanDiscount(rows)
		if scanErr != nil {
			return out, scanErr
		}
		out.Items = append(out.Items, d)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	ids := make([]string, 0, len(out.Items))
	byID := make(map[string]*commerce.DiscountCode, len(out.Items))
	for i := range out.Items {
		ids = append(ids, out.Items[i].ID)
		byID[out.Items[i].ID] = &out.Items[i]
	}
	if err = r.loadDiscountScopes(ctx, ids, byID); err != nil {
		return out, err
	}
	return out, nil
}

func insertDiscountScopes(ctx context.Context, tx pgx.Tx, id string, scopes []commerce.DiscountScope) error {
	for _, scope := range scopes {
		_, err := tx.Exec(ctx, `
INSERT INTO commerce_discount_scopes(discount_id,scope_type,product_id,product_type)
VALUES($1::uuid,$2,NULLIF($3,'')::uuid,NULLIF($4,''))
`, id, string(scope.ScopeType), scope.ProductID, string(scope.ProductType))
		if err != nil {
			return mapError(err)
		}
	}
	return nil
}

func (r *Repository) CreateDiscount(ctx context.Context, actor string, w commerce.DiscountWrite) (commerce.DiscountCode, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.DiscountCode{}, err
	}
	defer tx.Rollback(ctx)
	var id string
	err = tx.QueryRow(ctx, `
INSERT INTO commerce_discount_codes(
  code,label,discount_type,percentage_bps,fixed_minor,status,min_amount_minor,max_redemptions,
  starts_at,expires_at,created_by
) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid)
RETURNING id::text
`, w.Code, w.Label, string(w.DiscountType), w.PercentageBPS, w.FixedMinor, string(w.Status),
		w.MinAmountMinor, w.MaxRedemptions, w.StartsAt, w.ExpiresAt, actor).Scan(&id)
	if err != nil {
		return commerce.DiscountCode{}, mapError(err)
	}
	if err = insertDiscountScopes(ctx, tx, id, w.Scopes); err != nil {
		return commerce.DiscountCode{}, err
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: actor, Action: "commerce.discount.create", ResourceType: "commerce_discount", ResourceID: id,
		Metadata: map[string]any{"code": w.Code, "type": w.DiscountType, "scopeCount": len(w.Scopes)},
	}); err != nil {
		return commerce.DiscountCode{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.DiscountCode{}, err
	}
	return r.getDiscount(ctx, id)
}

func (r *Repository) UpdateDiscount(ctx context.Context, actor, id string, expected int, w commerce.DiscountWrite) (commerce.DiscountCode, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.DiscountCode{}, err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `
UPDATE commerce_discount_codes
SET code=$3,label=$4,discount_type=$5,percentage_bps=$6,fixed_minor=$7,status=$8,
    min_amount_minor=$9,max_redemptions=$10,starts_at=$11,expires_at=$12,
    revision=revision+1,updated_at=now()
WHERE id=$1::uuid AND revision=$2
  AND ($10=0 OR $10>=reserved_count+redeemed_count)
`, id, expected, w.Code, w.Label, string(w.DiscountType), w.PercentageBPS, w.FixedMinor,
		string(w.Status), w.MinAmountMinor, w.MaxRedemptions, w.StartsAt, w.ExpiresAt)
	if err != nil {
		return commerce.DiscountCode{}, mapError(err)
	}
	if tag.RowsAffected() == 0 {
		return commerce.DiscountCode{}, commerce.ErrVersionConflict
	}
	if _, err = tx.Exec(ctx, `DELETE FROM commerce_discount_scopes WHERE discount_id=$1::uuid`, id); err != nil {
		return commerce.DiscountCode{}, err
	}
	if err = insertDiscountScopes(ctx, tx, id, w.Scopes); err != nil {
		return commerce.DiscountCode{}, err
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: actor, Action: "commerce.discount.update", ResourceType: "commerce_discount", ResourceID: id,
		Metadata: map[string]any{"revision": expected + 1, "status": w.Status},
	}); err != nil {
		return commerce.DiscountCode{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.DiscountCode{}, err
	}
	return r.getDiscount(ctx, id)
}

type checkoutProduct struct {
	ID          string
	ProductType commerce.ProductType
	Name        string
	Status      commerce.ProductStatus
	AccessMode  commerce.AccessMode
	PriceMinor  int64
	Currency    string
	Revision    int
	Visible     bool
}

func loadCheckoutProduct(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, id string, lock bool) (checkoutProduct, error) {
	var p checkoutProduct
	sql := `
SELECT id::text,product_type,name,status,access_mode,price_minor,currency,revision,is_visible
FROM commerce_products
WHERE id=$1::uuid
`
	if lock {
		sql += " FOR SHARE"
	}
	err := q.QueryRow(ctx, sql, id).Scan(
		&p.ID, &p.ProductType, &p.Name, &p.Status, &p.AccessMode, &p.PriceMinor, &p.Currency, &p.Revision, &p.Visible,
	)
	if err != nil {
		return p, mapError(err)
	}
	if p.Status != commerce.ProductActive || !p.Visible || p.AccessMode != commerce.AccessPaid || p.PriceMinor <= 0 {
		return p, commerce.ErrConflict
	}
	return p, nil
}

func percentDiscount(price int64, bps int) int64 {
	whole := (price / 10000) * int64(bps)
	fraction := ((price % 10000) * int64(bps)) / 10000
	return whole + fraction
}

type resolvedDiscount struct {
	ID     string
	Code   string
	Label  string
	Amount int64
}

func resolveDiscountTx(ctx context.Context, tx pgx.Tx, p checkoutProduct, code string, lock bool) (resolvedDiscount, bool, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" {
		return resolvedDiscount{}, false, nil
	}
	var d resolvedDiscount
	var kind commerce.DiscountType
	var percentage *int
	var fixed *int64
	var minAmount int64
	var max, reserved, redeemed int
	sql := `
SELECT d.id::text,d.code,d.label,d.discount_type,d.percentage_bps,d.fixed_minor,d.min_amount_minor,
       d.max_redemptions,d.reserved_count,d.redeemed_count
FROM commerce_discount_codes d
WHERE d.code=$1
  AND d.status='active'
  AND (d.starts_at IS NULL OR d.starts_at<=now())
  AND (d.expires_at IS NULL OR d.expires_at>now())
  AND EXISTS(
    SELECT 1 FROM commerce_discount_scopes s
    WHERE s.discount_id=d.id
      AND (
        s.scope_type='all'
        OR (s.scope_type='product' AND s.product_id=$2::uuid)
        OR (s.scope_type='product_type' AND s.product_type=$3)
      )
  )
`
	if lock {
		sql += " FOR UPDATE"
	}
	err := tx.QueryRow(ctx, sql, code, p.ID, string(p.ProductType)).Scan(
		&d.ID, &d.Code, &d.Label, &kind, &percentage, &fixed, &minAmount, &max, &reserved, &redeemed,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return resolvedDiscount{}, false, nil
	}
	if err != nil {
		return resolvedDiscount{}, false, err
	}
	if p.PriceMinor < minAmount || (max > 0 && reserved+redeemed >= max) {
		return resolvedDiscount{}, false, nil
	}
	switch kind {
	case commerce.DiscountPercentage:
		if percentage == nil {
			return resolvedDiscount{}, false, commerce.ErrConflict
		}
		d.Amount = percentDiscount(p.PriceMinor, *percentage)
	case commerce.DiscountFixed:
		if fixed == nil {
			return resolvedDiscount{}, false, commerce.ErrConflict
		}
		d.Amount = *fixed
	default:
		return resolvedDiscount{}, false, commerce.ErrConflict
	}
	if d.Amount > p.PriceMinor {
		d.Amount = p.PriceMinor
	}
	if d.Amount < 1 || p.PriceMinor-d.Amount < 1 {
		return resolvedDiscount{}, false, nil
	}
	return d, true, nil
}

func (r *Repository) PreviewDiscount(ctx context.Context, productID, code string) (commerce.DiscountPreview, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.DiscountPreview{}, err
	}
	defer tx.Rollback(ctx)
	p, err := loadCheckoutProduct(ctx, tx, productID, false)
	if err != nil {
		return commerce.DiscountPreview{}, err
	}
	d, ok, err := resolveDiscountTx(ctx, tx, p, code, false)
	if err != nil {
		return commerce.DiscountPreview{}, err
	}
	out := commerce.DiscountPreview{
		Valid: ok, Code: strings.ToUpper(strings.TrimSpace(code)), OriginalAmountMinor: p.PriceMinor,
		FinalAmountMinor: p.PriceMinor, Currency: p.Currency,
	}
	if ok {
		out.Code = d.Code
		out.Label = d.Label
		out.DiscountAmountMinor = d.Amount
		out.FinalAmountMinor = p.PriceMinor - d.Amount
	} else {
		out.Message = "كود الخصم غير متاح لهذا المنتج."
	}
	return out, nil
}

const paymentSelect = `
SELECT id::text,user_id::text,product_id::text,product_revision,product_name,original_amount_minor,
       discount_amount_minor,final_amount_minor,currency,COALESCE(discount_id::text,''),discount_code,
       payment_method,gateway_mode,provider_code,status,idempotency_key,provider_transaction_id,
       provider_session_id,provider_redirect_url,provider_session_status,
       COALESCE(revenue_course_id::text,''),COALESCE(revenue_trainer_user_id::text,''),revenue_share_percentage,
       paid_at,COALESCE(reviewed_by::text,''),reviewed_at,reviewer_notes,approval_evidence,revision,created_at,updated_at
FROM commerce_payment_requests
`

func scanPayment(row scanner) (commerce.PaymentRequest, error) {
	var p commerce.PaymentRequest
	err := row.Scan(
		&p.ID, &p.UserID, &p.ProductID, &p.ProductRevision, &p.ProductName, &p.OriginalAmountMinor,
		&p.DiscountAmountMinor, &p.FinalAmountMinor, &p.Currency, &p.DiscountID, &p.DiscountCode,
		&p.PaymentMethod, &p.GatewayMode, &p.ProviderCode, &p.Status, &p.IdempotencyKey,
		&p.ProviderTransactionID, &p.ProviderSessionID, &p.ProviderRedirectURL, &p.ProviderSessionStatus,
		&p.RevenueCourseID, &p.RevenueTrainerUserID, &p.RevenueSharePercentage,
		&p.PaidAt, &p.ReviewedBy, &p.ReviewedAt, &p.ReviewerNotes,
		&p.ApprovalEvidence, &p.Revision, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return p, mapError(err)
	}
	return p, nil
}

func (r *Repository) getPayment(ctx context.Context, id string) (commerce.PaymentRequest, error) {
	return scanPayment(r.db.QueryRow(ctx, paymentSelect+` WHERE id=$1::uuid`, id))
}

func (r *Repository) CreatePaymentRequest(ctx context.Context, userID string, in commerce.CheckoutCreate, policy commerce.CheckoutPolicy, revenue commerce.RevenuePolicySnapshot) (commerce.PaymentRequest, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	defer tx.Rollback(ctx)

	existing, err := scanPayment(tx.QueryRow(ctx, paymentSelect+` WHERE user_id=$1::uuid AND idempotency_key=$2`, userID, in.IdempotencyKey))
	if err == nil {
		if existing.ProductID != in.ProductID || existing.PaymentMethod != in.PaymentMethod || existing.DiscountCode != in.DiscountCode {
			return commerce.PaymentRequest{}, commerce.ErrConflict
		}
		return existing, nil
	}
	if !errors.Is(err, commerce.ErrNotFound) {
		return commerce.PaymentRequest{}, err
	}

	p, err := loadCheckoutProduct(ctx, tx, in.ProductID, true)
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	discount, hasDiscount, err := resolveDiscountTx(ctx, tx, p, in.DiscountCode, true)
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	if in.DiscountCode != "" && !hasDiscount {
		return commerce.PaymentRequest{}, commerce.ErrConflict
	}
	discountAmount := int64(0)
	discountID := ""
	discountCode := ""
	if hasDiscount {
		discountAmount = discount.Amount
		discountID = discount.ID
		discountCode = discount.Code
	}
	finalAmount := p.PriceMinor - discountAmount
	if finalAmount < 1 {
		return commerce.PaymentRequest{}, commerce.ErrConflict
	}

	var id string
	err = tx.QueryRow(ctx, `
INSERT INTO commerce_payment_requests(
  user_id,product_id,product_revision,product_name,original_amount_minor,discount_amount_minor,
  final_amount_minor,currency,discount_id,discount_code,payment_method,gateway_mode,provider_code,idempotency_key,
  revenue_course_id,revenue_trainer_user_id,revenue_share_percentage
) VALUES(
  $1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,NULLIF($9,'')::uuid,$10,$11,$12,$13,$14,
  NULLIF($15,'')::uuid,NULLIF($16,'')::uuid,$17
)
ON CONFLICT(user_id,idempotency_key) DO NOTHING
RETURNING id::text
`, userID, p.ID, p.Revision, p.Name, p.PriceMinor, discountAmount, finalAmount, p.Currency,
		discountID, discountCode, string(in.PaymentMethod), string(policy.GatewayMode), policy.ProviderCode, in.IdempotencyKey,
		revenue.CourseID, revenue.TrainerUserID, revenue.RevenueSharePercentage).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		existing, getErr := scanPayment(tx.QueryRow(ctx, paymentSelect+` WHERE user_id=$1::uuid AND idempotency_key=$2`, userID, in.IdempotencyKey))
		if getErr != nil {
			return commerce.PaymentRequest{}, getErr
		}
		if existing.ProductID != in.ProductID || existing.PaymentMethod != in.PaymentMethod || existing.DiscountCode != discountCode {
			return commerce.PaymentRequest{}, commerce.ErrConflict
		}
		return existing, nil
	}
	if err != nil {
		return commerce.PaymentRequest{}, mapError(err)
	}
	if hasDiscount {
		tag, reserveErr := tx.Exec(ctx, `
UPDATE commerce_discount_codes
SET reserved_count=reserved_count+1,updated_at=now()
WHERE id=$1::uuid
  AND (max_redemptions=0 OR reserved_count+redeemed_count<max_redemptions)
`, discount.ID)
		if reserveErr != nil {
			return commerce.PaymentRequest{}, mapError(reserveErr)
		}
		if tag.RowsAffected() == 0 {
			return commerce.PaymentRequest{}, commerce.ErrConflict
		}
		if _, reserveErr = tx.Exec(ctx, `
INSERT INTO commerce_discount_redemptions(discount_id,payment_request_id,user_id,status)
VALUES($1::uuid,$2::uuid,$3::uuid,'reserved')
`, discount.ID, id, userID); reserveErr != nil {
			return commerce.PaymentRequest{}, mapError(reserveErr)
		}
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: userID, Action: "commerce.payment_request.create", ResourceType: "commerce_payment_request", ResourceID: id,
		Metadata: map[string]any{
			"productId": p.ID, "productRevision": p.Revision, "amountMinor": finalAmount,
			"currency": p.Currency, "discountCode": discountCode, "gatewayMode": policy.GatewayMode,
		},
	}); err != nil {
		return commerce.PaymentRequest{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.PaymentRequest{}, err
	}
	return r.getPayment(ctx, id)
}

func listPayments(ctx context.Context, db interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, where string, args []any, page, limit int) (commerce.PaymentRequestPage, error) {
	query := paymentSelect + where + " ORDER BY created_at DESC,id DESC LIMIT $" + string(rune('0'+len(args)+1)) + " OFFSET $" + string(rune('0'+len(args)+2))
	// The helper is intentionally only used with <=3 bind parameters in this file.
	args = append(args, limit+1, (page-1)*limit)
	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return commerce.PaymentRequestPage{}, err
	}
	defer rows.Close()
	out := commerce.PaymentRequestPage{Page: page, Limit: limit}
	for rows.Next() {
		p, scanErr := scanPayment(rows)
		if scanErr != nil {
			return out, scanErr
		}
		out.Items = append(out.Items, p)
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

func (r *Repository) ListUserPaymentRequests(ctx context.Context, userID string, page, limit int) (commerce.PaymentRequestPage, error) {
	rows, err := r.db.Query(ctx, paymentSelect+`
WHERE user_id=$1::uuid
ORDER BY created_at DESC,id DESC
LIMIT $2 OFFSET $3
`, userID, limit+1, (page-1)*limit)
	if err != nil {
		return commerce.PaymentRequestPage{}, err
	}
	defer rows.Close()
	out := commerce.PaymentRequestPage{Page: page, Limit: limit}
	for rows.Next() {
		p, scanErr := scanPayment(rows)
		if scanErr != nil {
			return out, scanErr
		}
		out.Items = append(out.Items, p)
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

func (r *Repository) ListAdminPaymentRequests(ctx context.Context, page, limit int, status commerce.PaymentStatus) (commerce.PaymentRequestPage, error) {
	rows, err := r.db.Query(ctx, paymentSelect+`
WHERE ($1='' OR status=$1)
ORDER BY created_at DESC,id DESC
LIMIT $2 OFFSET $3
`, string(status), limit+1, (page-1)*limit)
	if err != nil {
		return commerce.PaymentRequestPage{}, err
	}
	defer rows.Close()
	out := commerce.PaymentRequestPage{Page: page, Limit: limit}
	for rows.Next() {
		p, scanErr := scanPayment(rows)
		if scanErr != nil {
			return out, scanErr
		}
		out.Items = append(out.Items, p)
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

func settleDiscountTx(ctx context.Context, tx pgx.Tx, requestID, status string) error {
	var discountID string
	var current string
	err := tx.QueryRow(ctx, `
SELECT discount_id::text,status
FROM commerce_discount_redemptions
WHERE payment_request_id=$1::uuid
FOR UPDATE
`, requestID).Scan(&discountID, &current)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if current != "reserved" {
		return nil
	}
	switch status {
	case "redeemed":
		tag, err := tx.Exec(ctx, `
UPDATE commerce_discount_codes
SET reserved_count=reserved_count-1,redeemed_count=redeemed_count+1,updated_at=now()
WHERE id=$1::uuid AND reserved_count>0
`, discountID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return commerce.ErrConflict
		}
	case "released":
		tag, err := tx.Exec(ctx, `
UPDATE commerce_discount_codes
SET reserved_count=reserved_count-1,updated_at=now()
WHERE id=$1::uuid AND reserved_count>0
`, discountID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return commerce.ErrConflict
		}
	default:
		return commerce.ErrConflict
	}
	_, err = tx.Exec(ctx, `
UPDATE commerce_discount_redemptions SET status=$2,updated_at=now()
WHERE payment_request_id=$1::uuid AND status='reserved'
`, requestID, status)
	return err
}

func grantPaymentEntitlementTx(ctx context.Context, tx pgx.Tx, p commerce.PaymentRequest, sourceType, grantedBy string) error {
	var validityDays *int
	if err := tx.QueryRow(ctx, `
SELECT pk.validity_days
FROM commerce_products cp
LEFT JOIN commerce_packages pk ON pk.product_id=cp.id
WHERE cp.id=$1::uuid
`, p.ProductID).Scan(&validityDays); err != nil {
		return mapError(err)
	}
	_, err := tx.Exec(ctx, `
INSERT INTO commerce_entitlements(
 subject_type,user_id,product_id,source_type,source_id,status,granted_by_user_id,starts_at,expires_at,idempotency_key
) VALUES(
 'user',$1::uuid,$2::uuid,$3,$4,'active',NULLIF($5,'')::uuid,now(),
 CASE WHEN $6::int IS NULL THEN NULL ELSE now()+make_interval(days=>$6) END,
 'payment:'||$4
)
ON CONFLICT(idempotency_key) DO NOTHING
`, p.UserID, p.ProductID, sourceType, p.ID, grantedBy, validityDays)
	return mapError(err)
}

func (r *Repository) ReviewPaymentRequest(ctx context.Context, actor, id string, in commerce.PaymentReview) (commerce.PaymentRequest, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	defer tx.Rollback(ctx)
	p, err := scanPayment(tx.QueryRow(ctx, paymentSelect+` WHERE id=$1::uuid FOR UPDATE`, id))
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	if p.Status != commerce.PaymentPending || p.Revision != in.ExpectedRevision {
		return commerce.PaymentRequest{}, commerce.ErrVersionConflict
	}
	if in.Status == commerce.PaymentPaid {
		if err = grantPaymentEntitlementTx(ctx, tx, p, "payment_request", actor); err != nil {
			return commerce.PaymentRequest{}, err
		}
		if err = settleDiscountTx(ctx, tx, p.ID, "redeemed"); err != nil {
			return commerce.PaymentRequest{}, err
		}
	} else {
		if err = settleDiscountTx(ctx, tx, p.ID, "released"); err != nil {
			return commerce.PaymentRequest{}, err
		}
	}
	_, err = tx.Exec(ctx, `
UPDATE commerce_payment_requests
SET status=$2,paid_at=CASE WHEN $2='paid' THEN now() ELSE NULL END,
    reviewed_by=$3::uuid,reviewed_at=now(),reviewer_notes=$4,approval_evidence=$5,
    revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, id, string(in.Status), actor, in.ReviewerNotes, in.ApprovalEvidence)
	if err != nil {
		return commerce.PaymentRequest{}, mapError(err)
	}
	if in.Status == commerce.PaymentPaid {
		if err = ensureRevenueEntryTx(ctx, tx, p); err != nil {
			return commerce.PaymentRequest{}, err
		}
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: actor, Action: "commerce.payment_request.review", ResourceType: "commerce_payment_request", ResourceID: id,
		Metadata: map[string]any{"status": in.Status, "productId": p.ProductID, "amountMinor": p.FinalAmountMinor, "currency": p.Currency},
	}); err != nil {
		return commerce.PaymentRequest{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.PaymentRequest{}, err
	}
	return r.getPayment(ctx, id)
}

func rejectProviderEventTx(ctx context.Context, tx pgx.Tx, eventID, result string) error {
	if _, err := tx.Exec(ctx, `
UPDATE commerce_provider_events
SET processed_at=now(),processing_result=$2
WHERE id=$1::uuid
`, eventID, result); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) ApplyProviderEvent(ctx context.Context, provider string, in commerce.ProviderEvent) (commerce.ProviderEventResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.ProviderEventResult{}, err
	}
	defer tx.Rollback(ctx)

	var eventRowID string
	err = tx.QueryRow(ctx, `
INSERT INTO commerce_provider_events(
 provider_code,event_id,payment_request_id,transaction_id,event_status,amount_minor,currency,occurred_at,payload_sha256
) VALUES($1,$2,$3::uuid,$4,$5,$6,NULLIF($7,''),$8,$9)
ON CONFLICT(provider_code,event_id) DO NOTHING
RETURNING id::text
`, provider, in.EventID, in.PaymentRequestID, in.TransactionID, string(in.Status), in.AmountMinor, in.Currency, in.OccurredAt, in.PayloadSHA256).Scan(&eventRowID)
	if errors.Is(err, pgx.ErrNoRows) {
		var existingRequestID string
		if err = tx.QueryRow(ctx, `
SELECT payment_request_id::text FROM commerce_provider_events WHERE provider_code=$1 AND event_id=$2
`, provider, in.EventID).Scan(&existingRequestID); err != nil {
			return commerce.ProviderEventResult{}, mapError(err)
		}
		p, getErr := scanPayment(tx.QueryRow(ctx, paymentSelect+` WHERE id=$1::uuid`, existingRequestID))
		if getErr != nil {
			return commerce.ProviderEventResult{}, getErr
		}
		return commerce.ProviderEventResult{PaymentRequest: p, Duplicate: true}, nil
	}
	if err != nil {
		return commerce.ProviderEventResult{}, mapError(err)
	}

	p, err := scanPayment(tx.QueryRow(ctx, paymentSelect+` WHERE id=$1::uuid FOR UPDATE`, in.PaymentRequestID))
	if err != nil {
		return commerce.ProviderEventResult{}, err
	}
	if p.ProviderCode != provider || (p.GatewayMode != commerce.GatewayWebhook && p.GatewayMode != commerce.GatewayPaymentLink) {
		if commitErr := rejectProviderEventTx(ctx, tx, eventRowID, "rejected_provider_or_mode"); commitErr != nil {
			return commerce.ProviderEventResult{}, commitErr
		}
		return commerce.ProviderEventResult{}, commerce.ErrConflict
	}

	result := "already_" + string(p.Status)
	if p.Status == commerce.PaymentPending {
		switch in.Status {
		case commerce.ProviderPaid:
			if in.AmountMinor == nil || *in.AmountMinor != p.FinalAmountMinor || in.Currency != p.Currency {
				if commitErr := rejectProviderEventTx(ctx, tx, eventRowID, "rejected_amount_or_currency"); commitErr != nil {
					return commerce.ProviderEventResult{}, commitErr
				}
				return commerce.ProviderEventResult{}, commerce.ErrConflict
			}
			if err = grantPaymentEntitlementTx(ctx, tx, p, "payment_webhook", ""); err != nil {
				return commerce.ProviderEventResult{}, err
			}
			if err = settleDiscountTx(ctx, tx, p.ID, "redeemed"); err != nil {
				return commerce.ProviderEventResult{}, err
			}
			_, err = tx.Exec(ctx, `
UPDATE commerce_payment_requests
SET status='paid',paid_at=now(),provider_transaction_id=$2,revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, p.ID, in.TransactionID)
			if err == nil {
				err = ensureRevenueEntryTx(ctx, tx, p)
			}
			result = "paid_granted"
		case commerce.ProviderFailed:
			if err = settleDiscountTx(ctx, tx, p.ID, "released"); err != nil {
				return commerce.ProviderEventResult{}, err
			}
			_, err = tx.Exec(ctx, `
UPDATE commerce_payment_requests
SET status='failed',provider_transaction_id=$2,revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, p.ID, in.TransactionID)
			result = "failed_released"
		case commerce.ProviderCancelled:
			if err = settleDiscountTx(ctx, tx, p.ID, "released"); err != nil {
				return commerce.ProviderEventResult{}, err
			}
			_, err = tx.Exec(ctx, `
UPDATE commerce_payment_requests
SET status='cancelled',provider_transaction_id=$2,revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, p.ID, in.TransactionID)
			result = "cancelled_released"
		default:
			return commerce.ProviderEventResult{}, commerce.ErrConflict
		}
		if err != nil {
			return commerce.ProviderEventResult{}, mapError(err)
		}
	}

	_, err = tx.Exec(ctx, `
UPDATE commerce_provider_events
SET processed_at=now(),processing_result=$2
WHERE id=$1::uuid
`, eventRowID, result)
	if err != nil {
		return commerce.ProviderEventResult{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.ProviderEventResult{}, err
	}
	out, err := r.getPayment(ctx, p.ID)
	if err != nil {
		return commerce.ProviderEventResult{}, err
	}
	return commerce.ProviderEventResult{PaymentRequest: out}, nil
}
