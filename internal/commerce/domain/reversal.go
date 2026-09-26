package domain

import "time"

type PaymentReversalType string
type PaymentReversalSource string

const (
	PaymentRefund     PaymentReversalType = "refund"
	PaymentChargeback PaymentReversalType = "chargeback"

	ReversalProviderWebhook PaymentReversalSource = "provider_webhook"
	ReversalAdminEvidence   PaymentReversalSource = "admin_evidence"
)

func ValidPaymentReversalType(v PaymentReversalType) bool {
	return v == PaymentRefund || v == PaymentChargeback
}

type PaymentReversal struct {
	ID                string                `json:"id"`
	PaymentRequestID  string                `json:"paymentRequestId"`
	ReversalType      PaymentReversalType   `json:"reversalType"`
	AmountMinor       int64                 `json:"amountMinor"`
	Currency          string                `json:"currency"`
	ProviderCode      string                `json:"providerCode"`
	ProviderReference string                `json:"providerReference"`
	Source            PaymentReversalSource `json:"source"`
	Evidence          string                `json:"evidence"`
	OccurredAt        *time.Time            `json:"occurredAt"`
	CreatedAt         time.Time             `json:"createdAt"`
}

type PaymentReversalRecord struct {
	PaymentRequestID  string
	ReversalType      PaymentReversalType
	AmountMinor       int64
	Currency          string
	ProviderCode      string
	ProviderReference string
	Source            PaymentReversalSource
	Evidence          string
	PayloadSHA256     string
	OccurredAt        *time.Time
}

type AdminReversalRecord struct {
	ExpectedRevision  int                 `json:"expectedRevision"`
	ReversalType      PaymentReversalType `json:"reversalType"`
	ProviderReference string              `json:"providerReference"`
	Evidence          string              `json:"evidence"`
}

type PaymentReversalResult struct {
	PaymentRequest PaymentRequest  `json:"paymentRequest"`
	Reversal       PaymentReversal `json:"reversal"`
	Duplicate      bool            `json:"duplicate"`
}
