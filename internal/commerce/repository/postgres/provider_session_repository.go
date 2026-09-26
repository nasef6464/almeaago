package postgres

import (
	"context"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) AttachProviderSession(
	ctx context.Context,
	actorUserID, paymentRequestID string,
	expectedRevision int,
	session commerce.ProviderSession,
) (commerce.PaymentRequest, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	defer tx.Rollback(ctx)

	p, err := scanPayment(tx.QueryRow(ctx, paymentSelect+` WHERE id=$1::uuid FOR UPDATE`, paymentRequestID))
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	if p.Status != commerce.PaymentPending || p.GatewayMode != commerce.GatewayPaymentLink {
		return commerce.PaymentRequest{}, commerce.ErrConflict
	}
	if p.ProviderSessionStatus == "initiated" {
		return p, nil
	}
	if p.Revision != expectedRevision {
		return commerce.PaymentRequest{}, commerce.ErrVersionConflict
	}

	_, err = tx.Exec(ctx, `
UPDATE commerce_payment_requests
SET provider_session_id=$2,
    provider_redirect_url=$3,
    provider_session_status='initiated',
    revision=revision+1,
    updated_at=now()
WHERE id=$1::uuid
`, paymentRequestID, session.SessionID, session.RedirectURL)
	if err != nil {
		return commerce.PaymentRequest{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "commerce.provider_session.initiated",
		ResourceType: "commerce_payment_request",
		ResourceID:   paymentRequestID,
		Metadata: map[string]any{
			"provider":    p.ProviderCode,
			"sessionId":   session.SessionID,
			"amountMinor": p.FinalAmountMinor,
			"currency":    p.Currency,
		},
	}); err != nil {
		return commerce.PaymentRequest{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.PaymentRequest{}, err
	}
	return r.getPayment(ctx, paymentRequestID)
}

func (r *Repository) FailProviderSession(
	ctx context.Context,
	actorUserID, paymentRequestID string,
	expectedRevision int,
	reason string,
) (commerce.PaymentRequest, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	defer tx.Rollback(ctx)

	p, err := scanPayment(tx.QueryRow(ctx, paymentSelect+` WHERE id=$1::uuid FOR UPDATE`, paymentRequestID))
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	if p.GatewayMode != commerce.GatewayPaymentLink {
		return commerce.PaymentRequest{}, commerce.ErrConflict
	}
	if p.Status == commerce.PaymentFailed && p.ProviderSessionStatus == "failed" {
		return p, nil
	}
	if p.Status != commerce.PaymentPending || p.ProviderSessionStatus != "" || p.Revision != expectedRevision {
		return commerce.PaymentRequest{}, commerce.ErrVersionConflict
	}
	if err = settleDiscountTx(ctx, tx, paymentRequestID, "released"); err != nil {
		return commerce.PaymentRequest{}, err
	}
	_, err = tx.Exec(ctx, `
UPDATE commerce_payment_requests
SET status='failed',
    provider_session_status='failed',
    provider_redirect_url='',
    reviewer_notes=$2,
    revision=revision+1,
    updated_at=now()
WHERE id=$1::uuid
`, paymentRequestID, reason)
	if err != nil {
		return commerce.PaymentRequest{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "commerce.provider_session.failed",
		ResourceType: "commerce_payment_request",
		ResourceID:   paymentRequestID,
		Metadata: map[string]any{
			"provider":    p.ProviderCode,
			"reason":      reason,
			"amountMinor": p.FinalAmountMinor,
			"currency":    p.Currency,
		},
	}); err != nil {
		return commerce.PaymentRequest{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.PaymentRequest{}, err
	}
	return r.getPayment(ctx, paymentRequestID)
}
