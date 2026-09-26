package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

const reversalSelect = `
SELECT id::text,payment_request_id::text,reversal_type,amount_minor,currency,provider_code,
       provider_reference,source,evidence,occurred_at,created_at
FROM commerce_payment_reversals
`

func scanReversal(row scanner) (commerce.PaymentReversal, error) {
	var out commerce.PaymentReversal
	if err := row.Scan(
		&out.ID, &out.PaymentRequestID, &out.ReversalType, &out.AmountMinor, &out.Currency,
		&out.ProviderCode, &out.ProviderReference, &out.Source, &out.Evidence, &out.OccurredAt, &out.CreatedAt,
	); err != nil {
		return out, mapError(err)
	}
	return out, nil
}

func (r *Repository) PaymentRequestByProviderSession(ctx context.Context, provider, sessionID string) (commerce.PaymentRequest, error) {
	return scanPayment(r.db.QueryRow(ctx, paymentSelect+`
WHERE provider_code=$1 AND provider_session_id=$2
ORDER BY created_at DESC,id DESC
LIMIT 1
`, provider, sessionID))
}

func recordFullReversalTx(
	ctx context.Context,
	tx pgx.Tx,
	p commerce.PaymentRequest,
	actor string,
	in commerce.PaymentReversalRecord,
) (commerce.PaymentReversal, bool, error) {
	existing, err := scanReversal(tx.QueryRow(ctx, reversalSelect+` WHERE payment_request_id=$1::uuid FOR UPDATE`, p.ID))
	if err == nil {
		if existing.ReversalType != in.ReversalType || existing.AmountMinor != in.AmountMinor ||
			existing.Currency != in.Currency || existing.ProviderCode != in.ProviderCode ||
			existing.ProviderReference != in.ProviderReference {
			return commerce.PaymentReversal{}, false, commerce.ErrConflict
		}
		return existing, true, nil
	}
	if !errors.Is(err, commerce.ErrNotFound) {
		return commerce.PaymentReversal{}, false, err
	}
	if p.Status != commerce.PaymentPaid || in.AmountMinor != p.FinalAmountMinor || in.Currency != p.Currency ||
		in.ProviderCode != p.ProviderCode {
		return commerce.PaymentReversal{}, false, commerce.ErrConflict
	}

	var id string
	err = tx.QueryRow(ctx, `
INSERT INTO commerce_payment_reversals(
 payment_request_id,reversal_type,amount_minor,currency,provider_code,provider_reference,
 source,evidence,payload_sha256,recorded_by,occurred_at
) VALUES(
 $1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,'')::uuid,$11
)
RETURNING id::text
`, p.ID, string(in.ReversalType), in.AmountMinor, in.Currency, in.ProviderCode, in.ProviderReference,
		string(in.Source), in.Evidence, in.PayloadSHA256, actor, in.OccurredAt).Scan(&id)
	if err != nil {
		return commerce.PaymentReversal{}, false, mapError(err)
	}

	nextStatus := commerce.ReversalRefunded
	if in.ReversalType == commerce.ReversalChargeback {
		nextStatus = commerce.ReversalChargeback
	}
	_, err = tx.Exec(ctx, `
UPDATE commerce_payment_requests
SET status=$2,revision=revision+1,updated_at=now()
WHERE id=$1::uuid
`, p.ID, string(nextStatus))
	if err != nil {
		return commerce.PaymentReversal{}, false, mapError(err)
	}

	reason := "payment_" + string(in.ReversalType) + ":" + in.ProviderReference
	_, err = tx.Exec(ctx, `
UPDATE commerce_entitlements
SET status='revoked',
    revoked_at=now(),
    revoked_by_user_id=NULLIF($2,'')::uuid,
    revoke_reason=$3,
    revision=revision+1,
    updated_at=now()
WHERE source_type IN ('payment_request','payment_webhook')
  AND source_id=$1
  AND status='active'
`, p.ID, actor, reason)
	if err != nil {
		return commerce.PaymentReversal{}, false, mapError(err)
	}

	_, err = tx.Exec(ctx, `
UPDATE commerce_revenue_entries
SET reversal_type=$2,
    reversed_amount_minor=$3,
    reversal_reference=$4,
    reversed_at=COALESCE($5,now()),
    revision=revision+1,
    updated_at=now()
WHERE payment_request_id=$1::uuid
  AND reversal_type=''
`, p.ID, string(in.ReversalType), in.AmountMinor, in.ProviderReference, in.OccurredAt)
	if err != nil {
		return commerce.PaymentReversal{}, false, mapError(err)
	}

	out, scanErr := scanReversal(tx.QueryRow(ctx, reversalSelect+` WHERE id=$1::uuid`, id))
	return out, false, scanErr
}

func (r *Repository) applyProviderReversalTx(
	ctx context.Context,
	tx pgx.Tx,
	p commerce.PaymentRequest,
	provider string,
	in commerce.ProviderEvent,
) (string, error) {
	if in.AmountMinor == nil || *in.AmountMinor != p.FinalAmountMinor || in.Currency != p.Currency {
		return "", commerce.ErrConflict
	}
	reversalType := commerce.ReversalRefund
	if in.Status == commerce.ProviderChargeback {
		reversalType = commerce.ReversalChargeback
	} else if in.Status != commerce.ProviderRefunded {
		return "", commerce.ErrConflict
	}
	_, duplicate, err := recordFullReversalTx(ctx, tx, p, "", commerce.PaymentReversalRecord{
		PaymentRequestID:  p.ID,
		ReversalType:      reversalType,
		AmountMinor:       *in.AmountMinor,
		Currency:          in.Currency,
		ProviderCode:      provider,
		ProviderReference: in.EventID,
		Source:            commerce.ReversalProviderWebhook,
		PayloadSHA256:     in.PayloadSHA256,
		OccurredAt:        in.OccurredAt,
	})
	if err != nil {
		return "", err
	}
	if duplicate {
		return "reversal_duplicate", nil
	}
	return string(reversalType) + "_reversed", nil
}

func (r *Repository) RecordAdminReversal(
	ctx context.Context,
	actor, paymentRequestID string,
	expectedRevision int,
	in commerce.PaymentReversalRecord,
) (commerce.PaymentReversalResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.PaymentReversalResult{}, err
	}
	defer tx.Rollback(ctx)

	p, err := scanPayment(tx.QueryRow(ctx, paymentSelect+` WHERE id=$1::uuid FOR UPDATE`, paymentRequestID))
	if err != nil {
		return commerce.PaymentReversalResult{}, err
	}
	if p.Revision != expectedRevision {
		return commerce.PaymentReversalResult{}, commerce.ErrVersionConflict
	}
	in.PaymentRequestID = p.ID
	in.ProviderCode = p.ProviderCode
	in.AmountMinor = p.FinalAmountMinor
	in.Currency = p.Currency
	in.Source = commerce.ReversalAdminEvidence

	reversal, duplicate, err := recordFullReversalTx(ctx, tx, p, actor, in)
	if err != nil {
		return commerce.PaymentReversalResult{}, err
	}
	if !duplicate {
		if err = r.auditTx(ctx, tx, operations.AuditEvent{
			ActorUserID:  actor,
			Action:       "commerce.payment_reversal.record",
			ResourceType: "commerce_payment_request",
			ResourceID:   p.ID,
			Metadata: map[string]any{
				"reversalType": in.ReversalType, "providerReference": in.ProviderReference,
				"amountMinor": p.FinalAmountMinor, "currency": p.Currency,
			},
		}); err != nil {
			return commerce.PaymentReversalResult{}, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return commerce.PaymentReversalResult{}, err
	}
	out, err := r.getPayment(ctx, p.ID)
	if err != nil {
		return commerce.PaymentReversalResult{}, err
	}
	return commerce.PaymentReversalResult{PaymentRequest: out, Reversal: reversal, Duplicate: duplicate}, nil
}
