package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

const revenueSelect = `
SELECT id::text,payment_request_id::text,product_id::text,product_type,COALESCE(course_id::text,''),
       buyer_user_id::text,COALESCE(trainer_user_id::text,''),revenue_share_percentage,
       gross_amount_minor,discount_amount_minor,paid_amount_minor,currency,
       provider_fee_minor,trainer_share_minor,platform_share_minor,allocation_status,payout_status,
       allocation_evidence,COALESCE(allocated_by::text,''),allocated_at,
       payout_evidence,COALESCE(paid_by::text,''),payout_paid_at,
       reversal_type,reversed_amount_minor,reversal_reference,reversed_at,
       revision,created_at,updated_at
FROM commerce_revenue_entries
`

func scanRevenue(row scanner) (commerce.RevenueEntry, error) {
	var out commerce.RevenueEntry
	err := row.Scan(
		&out.ID, &out.PaymentRequestID, &out.ProductID, &out.ProductType, &out.CourseID,
		&out.BuyerUserID, &out.TrainerUserID, &out.RevenueSharePercentage,
		&out.GrossAmountMinor, &out.DiscountAmountMinor, &out.PaidAmountMinor, &out.Currency,
		&out.ProviderFeeMinor, &out.TrainerShareMinor, &out.PlatformShareMinor, &out.AllocationStatus, &out.PayoutStatus,
		&out.AllocationEvidence, &out.AllocatedBy, &out.AllocatedAt,
		&out.PayoutEvidence, &out.PaidBy, &out.PayoutPaidAt,
		&out.ReversalType, &out.ReversedAmountMinor, &out.ReversalReference, &out.ReversedAt,
		&out.Revision, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		return out, mapError(err)
	}
	return out, nil
}

func ensureRevenueEntryTx(ctx context.Context, tx pgx.Tx, p commerce.PaymentRequest) error {
	var productType commerce.ProductType
	if err := tx.QueryRow(ctx, `SELECT product_type FROM commerce_products WHERE id=$1::uuid`, p.ProductID).Scan(&productType); err != nil {
		return mapError(err)
	}
	allocation := commerce.RevenueNotApplicable
	payout := commerce.PayoutNotApplicable
	if p.RevenueTrainerUserID != "" {
		allocation = commerce.RevenuePolicyMissing
		payout = commerce.PayoutPending
		if p.RevenueSharePercentage != nil {
			allocation = commerce.RevenuePending
		}
	}
	_, err := tx.Exec(ctx, `
INSERT INTO commerce_revenue_entries(
 payment_request_id,product_id,product_type,course_id,buyer_user_id,trainer_user_id,revenue_share_percentage,
 gross_amount_minor,discount_amount_minor,paid_amount_minor,currency,allocation_status,payout_status
) VALUES(
 $1::uuid,$2::uuid,$3,NULLIF($4,'')::uuid,$5::uuid,NULLIF($6,'')::uuid,$7,$8,$9,$10,$11,$12,$13
)
ON CONFLICT(payment_request_id) DO NOTHING
`, p.ID, p.ProductID, string(productType), p.RevenueCourseID, p.UserID, p.RevenueTrainerUserID,
		p.RevenueSharePercentage, p.OriginalAmountMinor, p.DiscountAmountMinor, p.FinalAmountMinor, p.Currency,
		string(allocation), string(payout))
	return mapError(err)
}

func (r *Repository) getRevenueEntry(ctx context.Context, id string) (commerce.RevenueEntry, error) {
	return scanRevenue(r.db.QueryRow(ctx, revenueSelect+` WHERE id=$1::uuid`, id))
}

func (r *Repository) ListRevenueEntries(
	ctx context.Context,
	page, limit int,
	allocation commerce.RevenueAllocationStatus,
	payout commerce.PayoutStatus,
) (commerce.RevenueEntryPage, error) {
	rows, err := r.db.Query(ctx, revenueSelect+`
WHERE ($1='' OR allocation_status=$1)
  AND ($2='' OR payout_status=$2)
ORDER BY created_at DESC,id DESC
LIMIT $3 OFFSET $4
`, string(allocation), string(payout), limit+1, (page-1)*limit)
	if err != nil {
		return commerce.RevenueEntryPage{}, err
	}
	defer rows.Close()
	out := commerce.RevenueEntryPage{Page: page, Limit: limit}
	for rows.Next() {
		item, scanErr := scanRevenue(rows)
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

func (r *Repository) AllocateRevenue(ctx context.Context, actor, id string, in commerce.RevenueAllocation) (commerce.RevenueEntry, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.RevenueEntry{}, err
	}
	defer tx.Rollback(ctx)
	row, err := scanRevenue(tx.QueryRow(ctx, revenueSelect+` WHERE id=$1::uuid FOR UPDATE`, id))
	if err != nil {
		return commerce.RevenueEntry{}, err
	}
	if row.Revision != in.ExpectedRevision {
		return commerce.RevenueEntry{}, commerce.ErrVersionConflict
	}
	if row.ReversalType != "" || row.AllocationStatus != commerce.RevenuePending || row.TrainerUserID == "" || row.RevenueSharePercentage == nil {
		return commerce.RevenueEntry{}, commerce.ErrConflict
	}
	if in.ProviderFeeMinor+in.TrainerShareMinor+in.PlatformShareMinor != row.PaidAmountMinor {
		return commerce.RevenueEntry{}, commerce.ErrConflict
	}
	nextPayout := commerce.PayoutPending
	if in.TrainerShareMinor == 0 {
		nextPayout = commerce.PayoutNotApplicable
	}
	_, err = tx.Exec(ctx, `
UPDATE commerce_revenue_entries
SET provider_fee_minor=$2,trainer_share_minor=$3,platform_share_minor=$4,
    allocation_status='allocated',payout_status=$5,allocation_evidence=$6,
    allocated_by=$7::uuid,allocated_at=now(),revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, id, in.ProviderFeeMinor, in.TrainerShareMinor, in.PlatformShareMinor, string(nextPayout), in.Evidence, actor)
	if err != nil {
		return commerce.RevenueEntry{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: actor, Action: "commerce.revenue.allocate", ResourceType: "commerce_revenue_entry", ResourceID: id,
		Metadata: map[string]any{
			"paymentRequestId": row.PaymentRequestID, "providerFeeMinor": in.ProviderFeeMinor,
			"trainerShareMinor": in.TrainerShareMinor, "platformShareMinor": in.PlatformShareMinor,
			"currency": row.Currency,
		},
	}); err != nil {
		return commerce.RevenueEntry{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.RevenueEntry{}, err
	}
	return r.getRevenueEntry(ctx, id)
}

func (r *Repository) MarkPayoutPaid(ctx context.Context, actor, id string, in commerce.PayoutMarkPaid) (commerce.RevenueEntry, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.RevenueEntry{}, err
	}
	defer tx.Rollback(ctx)
	row, err := scanRevenue(tx.QueryRow(ctx, revenueSelect+` WHERE id=$1::uuid FOR UPDATE`, id))
	if err != nil {
		return commerce.RevenueEntry{}, err
	}
	if row.Revision != in.ExpectedRevision {
		return commerce.RevenueEntry{}, commerce.ErrVersionConflict
	}
	if row.ReversalType != "" || row.AllocationStatus != commerce.RevenueAllocated || row.PayoutStatus != commerce.PayoutPending || row.TrainerShareMinor == nil || *row.TrainerShareMinor <= 0 {
		return commerce.RevenueEntry{}, commerce.ErrConflict
	}
	_, err = tx.Exec(ctx, `
UPDATE commerce_revenue_entries
SET payout_status='paid',payout_evidence=$2,paid_by=$3::uuid,payout_paid_at=now(),
    revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, id, in.Evidence, actor)
	if err != nil {
		return commerce.RevenueEntry{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID: actor, Action: "commerce.payout.mark_paid", ResourceType: "commerce_revenue_entry", ResourceID: id,
		Metadata: map[string]any{
			"paymentRequestId": row.PaymentRequestID, "trainerUserId": row.TrainerUserID,
			"trainerShareMinor": *row.TrainerShareMinor, "currency": row.Currency,
		},
	}); err != nil {
		return commerce.RevenueEntry{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.RevenueEntry{}, err
	}
	return r.getRevenueEntry(ctx, id)
}
