package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type paymentQueryer interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func scanDiscount(row scanner) (commerce.DiscountCode, error) {
	var d commerce.DiscountCode
	var bps int
	var fixed int64
	err := row.Scan(
		&d.ID, &d.Code, &d.Label, &d.Type, &bps, &fixed, &d.Currency, &d.Status,
		&d.ProductID, &d.ProductType, &d.MinAmountMinor, &d.MaxRedemptions, &d.CurrentRedemptions,
		&d.StartsAt, &d.ExpiresAt, &d.Revision, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return d, mapError(err)
	}
	if d.Type == commerce.DiscountPercentage {
		d.Value = int64(bps / 100)
	} else {
		d.Value = fixed
	}
	return d, nil
}

const discountSelect = `
SELECT id::text,code,label,discount_type,percentage_bps,fixed_minor,currency,status,
       COALESCE(product_id::text,''),COALESCE(product_type,''),min_amount_minor,max_redemptions,current_redemptions,
       starts_at,expires_at,revision,created_at,updated_at
FROM commerce_discount_codes
`

func scanPayment(row scanner) (commerce.PaymentRequest, error) {
	var p commerce.PaymentRequest
	err := row.Scan(
		&p.ID, &p.UserID, &p.ProductID, &p.ProductRevision, &p.ProductName, &p.ProductType,
		&p.OriginalAmountMinor, &p.DiscountAmountMinor, &p.FinalAmountMinor, &p.Currency,
		&p.DiscountCodeID, &p.DiscountCode, &p.PaymentMethod, &p.ProviderCode, &p.GatewayMode,
		&p.PaymentCountry, &p.TransferReference, &p.WalletNumber, &p.Notes, &p.Status,
		&p.ReviewerNotes, &p.ApprovalEvidence, &p.ReviewedBy, &p.ReviewedAt,
		&p.ProviderTransaction, &p.ProviderEventID, &p.PaidAt, &p.IdempotencyKey, &p.Revision,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return p, mapError(err)
	}
	return p, nil
}

const paymentSelect = `
SELECT id::text,user_id::text,product_id::text,product_revision,product_name,product_type,
       original_amount_minor,discount_amount_minor,final_amount_minor,currency,
       COALESCE(discount_code_id::text,''),discount_code,payment_method,provider_code,gateway_mode,
       payment_country,transfer_reference,wallet_number,notes,status,reviewer_notes,approval_evidence,
       COALESCE(reviewed_by::text,''),reviewed_at,provider_transaction_id,provider_event_id,paid_at,
       idempotency_key,revision,created_at,updated_at
FROM commerce_payment_requests
`

func resolveCheckoutQuote(ctx context.Context, q paymentQueryer, userID, productID, discountCode string) (commerce.CheckoutQuote, error) {
	var out commerce.CheckoutQuote
	var already bool
	err := q.QueryRow(ctx, `
SELECT p.id::text,p.name,p.product_type,COALESCE(p.course_id::text,''),p.revision,p.price_minor,p.currency,
       EXISTS(
         SELECT 1 FROM commerce_entitlements e
         WHERE e.user_id=$2::uuid AND e.product_id=p.id AND e.status='active'
           AND e.starts_at<=now() AND (e.expires_at IS NULL OR e.expires_at>now())
       )
FROM commerce_products p
WHERE p.id=$1::uuid AND p.status='active' AND p.is_visible=true AND p.access_mode='paid' AND p.price_minor>0
`, productID, userID).Scan(
		&out.ProductID, &out.ProductName, &out.ProductType, &out.CourseID,
		&out.ProductRevision, &out.OriginalAmountMinor, &out.Currency, &already,
	)
	if err != nil {
		return out, mapError(err)
	}
	if already {
		return out, commerce.ErrConflict
	}
	discountCode = strings.ToUpper(strings.TrimSpace(discountCode))
	if discountCode == "" {
		out.FinalAmountMinor = out.OriginalAmountMinor
		return out, nil
	}

	var id, code string
	var kind commerce.DiscountType
	var bps int
	var fixed int64
	var currency string
	var status commerce.DiscountStatus
	var scopedProduct string
	var scopedType commerce.ProductType
	var min int64
	var max, current int
	var starts, expires *time.Time
	err = q.QueryRow(ctx, `
SELECT id::text,code,discount_type,percentage_bps,fixed_minor,currency,status,
       COALESCE(product_id::text,''),COALESCE(product_type,''),min_amount_minor,max_redemptions,current_redemptions,
       starts_at,expires_at
FROM commerce_discount_codes
WHERE code=$1
`, discountCode).Scan(&id, &code, &kind, &bps, &fixed, &currency, &status, &scopedProduct, &scopedType, &min, &max, &current, &starts, &expires)
	if err != nil {
		return out, mapError(err)
	}
	now := time.Now().UTC()
	if status != commerce.DiscountActive || (starts != nil && now.Before(*starts)) || (expires != nil && !now.Before(*expires)) ||
		(max > 0 && current >= max) || out.OriginalAmountMinor < min ||
		(scopedProduct != "" && scopedProduct != out.ProductID) || (scopedType != "" && scopedType != out.ProductType) {
		return out, commerce.ErrConflict
	}
	var amount int64
	if kind == commerce.DiscountPercentage {
		amount = out.OriginalAmountMinor * int64(bps) / 10000
	} else {
		if currency != out.Currency {
			return out, commerce.ErrConflict
		}
		amount = fixed
	}
	if amount > out.OriginalAmountMinor {
		amount = out.OriginalAmountMinor
	}
	out.DiscountCode = code
	out.DiscountAmountMinor = amount
	out.FinalAmountMinor = out.OriginalAmountMinor - amount
	return out, nil
}

func (r *Repository) GetCheckoutQuote(ctx context.Context, userID, productID, discountCode string) (commerce.CheckoutQuote, error) {
	return resolveCheckoutQuote(ctx, r.db, userID, productID, discountCode)
}

func (r *Repository) CreatePaymentRequest(ctx context.Context, userID string, in commerce.PaymentRequestCreate, providerCode string, mode commerce.GatewayMode) (commerce.PaymentRequest, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	defer tx.Rollback(ctx)

	existing, existingErr := scanPayment(tx.QueryRow(ctx, paymentSelect+` WHERE idempotency_key=$1`, in.IdempotencyKey))
	if existingErr == nil {
		if existing.UserID != userID || existing.ProductID != in.ProductID {
			return commerce.PaymentRequest{}, commerce.ErrConflict
		}
		return existing, nil
	}
	if !errors.Is(existingErr, commerce.ErrNotFound) {
		return commerce.PaymentRequest{}, existingErr
	}

	quote, err := resolveCheckoutQuote(ctx, tx, userID, in.ProductID, in.DiscountCode)
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	var discountID string
	if quote.DiscountCode != "" {
		err = tx.QueryRow(ctx, `SELECT id::text FROM commerce_discount_codes WHERE code=$1`, quote.DiscountCode).Scan(&discountID)
		if err != nil {
			return commerce.PaymentRequest{}, mapError(err)
		}
	}
	var id string
	err = tx.QueryRow(ctx, `
INSERT INTO commerce_payment_requests(
  user_id,product_id,product_revision,product_name,product_type,original_amount_minor,discount_amount_minor,
  final_amount_minor,currency,discount_code_id,discount_code,payment_method,provider_code,gateway_mode,
  payment_country,transfer_reference,wallet_number,notes,idempotency_key
) VALUES(
  $1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,'')::uuid,$11,$12,$13,$14,$15,$16,$17,$18,$19
) RETURNING id::text
`, userID, quote.ProductID, quote.ProductRevision, quote.ProductName, string(quote.ProductType), quote.OriginalAmountMinor,
		quote.DiscountAmountMinor, quote.FinalAmountMinor, quote.Currency, discountID, quote.DiscountCode,
		string(in.PaymentMethod), providerCode, string(mode), in.PaymentCountry, in.TransferReference, in.WalletNumber,
		in.Notes, in.IdempotencyKey).Scan(&id)
	if err != nil {
		return commerce.PaymentRequest{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: userID, Action: "commerce.payment_request.create",
		ResourceType: "commerce_payment_request", ResourceID: id,
		Metadata: map[string]any{"productId": quote.ProductID, "finalAmountMinor": quote.FinalAmountMinor, "currency": quote.Currency, "paymentMethod": in.PaymentMethod},
	}); err != nil {
		return commerce.PaymentRequest{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.PaymentRequest{}, err
	}
	return scanPayment(r.db.QueryRow(ctx, paymentSelect+` WHERE id=$1::uuid`, id))
}

func (r *Repository) GetPaymentRequest(ctx context.Context, id string) (commerce.PaymentRequest, error) {
	return scanPayment(r.db.QueryRow(ctx, paymentSelect+` WHERE id=$1::uuid`, id))
}

func (r *Repository) ListPaymentRequests(ctx context.Context, page, limit int, status commerce.PaymentStatus, userID string) (commerce.PaymentRequestPage, error) {
	rows, err := r.db.Query(ctx, paymentSelect+`
WHERE ($1='' OR status=$1)
  AND ($2='' OR user_id::text=$2)
ORDER BY created_at DESC,id DESC
LIMIT $3 OFFSET $4
`, string(status), userID, limit+1, (page-1)*limit)
	if err != nil {
		return commerce.PaymentRequestPage{}, err
	}
	defer rows.Close()
	out := commerce.PaymentRequestPage{Page: page, Limit: limit}
	for rows.Next() {
		item, scanErr := scanPayment(rows)
		if scanErr != nil {
			return out, scanErr
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

func discountStillValid(ctx context.Context, tx pgx.Tx, request commerce.PaymentRequest, consume bool) (bool, error) {
	if request.DiscountCodeID == "" {
		return true, nil
	}
	var status commerce.DiscountStatus
	var productID string
	var productType commerce.ProductType
	var min int64
	var max, current int
	var starts, expires *time.Time
	err := tx.QueryRow(ctx, `
SELECT status,COALESCE(product_id::text,''),COALESCE(product_type,''),min_amount_minor,max_redemptions,current_redemptions,starts_at,expires_at
FROM commerce_discount_codes WHERE id=$1::uuid FOR UPDATE
`, request.DiscountCodeID).Scan(&status, &productID, &productType, &min, &max, &current, &starts, &expires)
	if err != nil {
		return false, mapError(err)
	}
	now := time.Now().UTC()
	valid := status == commerce.DiscountActive &&
		(starts == nil || !now.Before(*starts)) &&
		(expires == nil || now.Before(*expires)) &&
		(max == 0 || current < max) &&
		request.OriginalAmountMinor >= min &&
		(productID == "" || productID == request.ProductID) &&
		(productType == "" || productType == request.ProductType)
	if !valid {
		return false, nil
	}
	if consume {
		_, err = tx.Exec(ctx, `
UPDATE commerce_discount_codes
SET current_redemptions=current_redemptions+1,revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, request.DiscountCodeID)
		if err != nil {
			return false, err
		}
	}
	return true, nil
}

func grantPaymentEntitlement(ctx context.Context, tx pgx.Tx, request commerce.PaymentRequest, sourceType, actor string) (string, error) {
	var expires *time.Time
	var days *int
	err := tx.QueryRow(ctx, `SELECT validity_days FROM commerce_packages WHERE product_id=$1::uuid`, request.ProductID).Scan(&days)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	if days != nil {
		value := time.Now().UTC().Add(time.Duration(*days) * 24 * time.Hour)
		expires = &value
	}
	var id string
	err = tx.QueryRow(ctx, `
INSERT INTO commerce_entitlements(
  subject_type,user_id,product_id,source_type,source_id,status,granted_by_user_id,starts_at,expires_at,idempotency_key,metadata
) VALUES(
  'user',$1::uuid,$2::uuid,$3,$4,'active',NULLIF($5,'')::uuid,now(),$6,$7,
  jsonb_build_object('paymentRequestId',$4,'amountMinor',$8,'currency',$9)
)
ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
RETURNING id::text
`, request.UserID, request.ProductID, sourceType, request.ID, actor, expires,
		"payment-request:"+request.ID, request.FinalAmountMinor, request.Currency).Scan(&id)
	if err != nil {
		return "", mapError(err)
	}
	return id, nil
}

func (r *Repository) ReviewPaymentRequest(ctx context.Context, actor, id string, review commerce.PaymentReview) (commerce.PaymentRequest, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	defer tx.Rollback(ctx)
	request, err := scanPayment(tx.QueryRow(ctx, paymentSelect+` WHERE id=$1::uuid FOR UPDATE`, id))
	if err != nil {
		return request, err
	}
	if request.Status != commerce.PaymentPending || request.Revision != review.ExpectedRevision {
		return commerce.PaymentRequest{}, commerce.ErrVersionConflict
	}
	if review.Status == commerce.PaymentApproved {
		ok, checkErr := discountStillValid(ctx, tx, request, false)
		if checkErr != nil {
			return commerce.PaymentRequest{}, checkErr
		}
		if !ok {
			return commerce.PaymentRequest{}, commerce.ErrConflict
		}
		if request.DiscountCodeID != "" {
			if _, checkErr = discountStillValid(ctx, tx, request, true); checkErr != nil {
				return commerce.PaymentRequest{}, checkErr
			}
		}
		if _, err = grantPaymentEntitlement(ctx, tx, request, "payment_request", actor); err != nil {
			return commerce.PaymentRequest{}, err
		}
	}
	_, err = tx.Exec(ctx, `
UPDATE commerce_payment_requests
SET status=$2,reviewer_notes=$3,approval_evidence=$4,reviewed_by=$5::uuid,reviewed_at=now(),revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, id, string(review.Status), review.ReviewerNotes, review.ApprovalEvidence, actor)
	if err != nil {
		return commerce.PaymentRequest{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: actor, Action: "commerce.payment_request.review",
		ResourceType: "commerce_payment_request", ResourceID: id,
		Metadata: map[string]any{"status": review.Status, "productId": request.ProductID, "userId": request.UserID},
	}); err != nil {
		return commerce.PaymentRequest{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.PaymentRequest{}, err
	}
	return r.GetPaymentRequest(ctx, id)
}

func (r *Repository) ListDiscountCodes(ctx context.Context, page, limit int, status commerce.DiscountStatus, search string) (commerce.DiscountPage, error) {
	rows, err := r.db.Query(ctx, discountSelect+`
WHERE ($1='' OR status=$1) AND ($2='' OR code ILIKE '%'||$2||'%' OR label ILIKE '%'||$2||'%')
ORDER BY updated_at DESC,id DESC LIMIT $3 OFFSET $4
`, string(status), search, limit+1, (page-1)*limit)
	if err != nil {
		return commerce.DiscountPage{}, err
	}
	defer rows.Close()
	out := commerce.DiscountPage{Page: page, Limit: limit}
	for rows.Next() {
		item, scanErr := scanDiscount(rows)
		if scanErr != nil {
			return out, scanErr
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

func discountValues(w commerce.DiscountWrite) (int, int64) {
	if w.Type == commerce.DiscountPercentage {
		return int(w.Value * 100), 0
	}
	return 0, w.Value
}

func (r *Repository) CreateDiscountCode(ctx context.Context, actor string, w commerce.DiscountWrite) (commerce.DiscountCode, error) {
	bps, fixed := discountValues(w)
	var id string
	err := r.db.QueryRow(ctx, `
INSERT INTO commerce_discount_codes(
 code,label,discount_type,percentage_bps,fixed_minor,currency,status,product_id,product_type,min_amount_minor,
 max_redemptions,starts_at,expires_at,created_by
) VALUES($1,$2,$3,$4,$5,$6,$7,NULLIF($8,'')::uuid,NULLIF($9,''),$10,$11,$12,$13,$14::uuid)
RETURNING id::text
`, w.Code, w.Label, string(w.Type), bps, fixed, w.Currency, string(w.Status), w.ProductID, string(w.ProductType),
		w.MinAmountMinor, w.MaxRedemptions, w.StartsAt, w.ExpiresAt, actor).Scan(&id)
	if err != nil {
		return commerce.DiscountCode{}, mapError(err)
	}
	return scanDiscount(r.db.QueryRow(ctx, discountSelect+` WHERE id=$1::uuid`, id))
}

func (r *Repository) UpdateDiscountCode(ctx context.Context, actor, id string, expected int, w commerce.DiscountWrite) (commerce.DiscountCode, error) {
	bps, fixed := discountValues(w)
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.DiscountCode{}, err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `
UPDATE commerce_discount_codes
SET code=$3,label=$4,discount_type=$5,percentage_bps=$6,fixed_minor=$7,currency=$8,status=$9,
    product_id=NULLIF($10,'')::uuid,product_type=NULLIF($11,''),min_amount_minor=$12,max_redemptions=$13,
    starts_at=$14,expires_at=$15,revision=revision+1,updated_at=now()
WHERE id=$1::uuid AND revision=$2
`, id, expected, w.Code, w.Label, string(w.Type), bps, fixed, w.Currency, string(w.Status), w.ProductID,
		string(w.ProductType), w.MinAmountMinor, w.MaxRedemptions, w.StartsAt, w.ExpiresAt)
	if err != nil {
		return commerce.DiscountCode{}, mapError(err)
	}
	if tag.RowsAffected() == 0 {
		return commerce.DiscountCode{}, commerce.ErrVersionConflict
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: actor, Action: "commerce.discount.update", ResourceType: "commerce_discount_code", ResourceID: id,
		Metadata: map[string]any{"status": w.Status, "code": w.Code},
	}); err != nil {
		return commerce.DiscountCode{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.DiscountCode{}, err
	}
	return scanDiscount(r.db.QueryRow(ctx, discountSelect+` WHERE id=$1::uuid`, id))
}

func (r *Repository) ApplyProviderEvent(ctx context.Context, event commerce.ProviderEventInput) (commerce.ProviderEventResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.ProviderEventResult{}, err
	}
	defer tx.Rollback(ctx)

	var existingRequestID, existingStatus, existingReason string
	err = tx.QueryRow(ctx, `
SELECT payment_request_id::text,processing_status,processing_reason
FROM commerce_provider_events WHERE provider_code=$1 AND event_id=$2
`, event.ProviderCode, event.EventID).Scan(&existingRequestID, &existingStatus, &existingReason)
	if err == nil {
		request, getErr := r.GetPaymentRequest(ctx, existingRequestID)
		if getErr != nil {
			return commerce.ProviderEventResult{}, getErr
		}
		return commerce.ProviderEventResult{
			EventID: event.EventID, Duplicate: true, Accepted: existingStatus == "applied",
			ProcessingStatus: existingStatus, PaymentRequest: request,
		}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return commerce.ProviderEventResult{}, err
	}

	request, err := scanPayment(tx.QueryRow(ctx, paymentSelect+` WHERE id=$1::uuid FOR UPDATE`, event.PaymentRequestID))
	if err != nil {
		return commerce.ProviderEventResult{}, err
	}
	processing, reason, entitlementID := "ignored", "", ""
	accepted := false

	switch {
	case request.ProviderCode != event.ProviderCode:
		processing, reason = "rejected", "provider_mismatch"
	case request.Status != commerce.PaymentPending:
		processing, reason = "ignored", "payment_request_already_final"
	case event.Status == commerce.ProviderPaid && (event.AmountMinor != request.FinalAmountMinor || event.Currency != request.Currency):
		processing, reason = "rejected", "amount_or_currency_mismatch"
	case event.Status == commerce.ProviderPaid:
		valid, checkErr := discountStillValid(ctx, tx, request, false)
		if checkErr != nil {
			return commerce.ProviderEventResult{}, checkErr
		}
		if !valid {
			processing, reason = "rejected", "discount_no_longer_available"
			break
		}
		if request.DiscountCodeID != "" {
			if _, checkErr = discountStillValid(ctx, tx, request, true); checkErr != nil {
				return commerce.ProviderEventResult{}, checkErr
			}
		}
		entitlementID, err = grantPaymentEntitlement(ctx, tx, request, "payment_webhook", "")
		if err != nil {
			return commerce.ProviderEventResult{}, err
		}
		_, err = tx.Exec(ctx, `
UPDATE commerce_payment_requests
SET status='approved',reviewer_notes='Trusted provider event',approval_evidence=$2,reviewed_at=now(),
    provider_transaction_id=$3,provider_event_id=$4,paid_at=COALESCE($5,now()),revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, request.ID, fmt.Sprintf("provider:%s event:%s", event.ProviderCode, event.EventID), event.TransactionID, event.EventID, event.OccurredAt)
		if err != nil {
			return commerce.ProviderEventResult{}, err
		}
		processing, reason, accepted = "applied", "paid", true
	case event.Status == commerce.ProviderFailed:
		_, err = tx.Exec(ctx, `
UPDATE commerce_payment_requests
SET status='rejected',reviewer_notes='Provider reported failed payment',approval_evidence=$2,reviewed_at=now(),
    provider_transaction_id=$3,provider_event_id=$4,revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, request.ID, fmt.Sprintf("provider:%s event:%s", event.ProviderCode, event.EventID), event.TransactionID, event.EventID)
		if err != nil {
			return commerce.ProviderEventResult{}, err
		}
		processing, reason, accepted = "applied", "failed", true
	case event.Status == commerce.ProviderCancelled:
		_, err = tx.Exec(ctx, `
UPDATE commerce_payment_requests
SET status='cancelled',reviewer_notes='Provider reported cancelled payment',approval_evidence=$2,reviewed_at=now(),
    provider_transaction_id=$3,provider_event_id=$4,revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, request.ID, fmt.Sprintf("provider:%s event:%s", event.ProviderCode, event.EventID), event.TransactionID, event.EventID)
		if err != nil {
			return commerce.ProviderEventResult{}, err
		}
		processing, reason, accepted = "applied", "cancelled", true
	}

	_, err = tx.Exec(ctx, `
INSERT INTO commerce_provider_events(
 provider_code,event_id,payment_request_id,event_status,transaction_id,amount_minor,currency,payload_sha256,
 signature_verified,processing_status,processing_reason,occurred_at
) VALUES($1,$2,$3::uuid,$4,$5,$6,$7,$8,true,$9,$10,$11)
`, event.ProviderCode, event.EventID, event.PaymentRequestID, string(event.Status), event.TransactionID, event.AmountMinor,
		event.Currency, event.PayloadSHA256, processing, reason, event.OccurredAt)
	if err != nil {
		return commerce.ProviderEventResult{}, mapError(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.ProviderEventResult{}, err
	}
	finalRequest, err := r.GetPaymentRequest(ctx, request.ID)
	if err != nil {
		return commerce.ProviderEventResult{}, err
	}
	return commerce.ProviderEventResult{
		EventID: event.EventID, Accepted: accepted, ProcessingStatus: processing,
		PaymentRequest: finalRequest, EntitlementID: entitlementID,
	}, nil
}
