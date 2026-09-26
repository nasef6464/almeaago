package domain

import "time"

type DiscountType string
type DiscountStatus string
type DiscountScopeType string
type PaymentMethod string
type GatewayMode string
type PaymentStatus string
type ProviderEventStatus string

const (
	DiscountPercentage DiscountType = "percentage"
	DiscountFixed      DiscountType = "fixed"

	DiscountActive  DiscountStatus = "active"
	DiscountPaused  DiscountStatus = "paused"
	DiscountExpired DiscountStatus = "expired"

	DiscountScopeAll         DiscountScopeType = "all"
	DiscountScopeProduct     DiscountScopeType = "product"
	DiscountScopeProductType DiscountScopeType = "product_type"

	PaymentCard     PaymentMethod = "card"
	PaymentTransfer PaymentMethod = "transfer"
	PaymentWallet   PaymentMethod = "wallet"

	GatewayManualReview GatewayMode = "manual_review"
	GatewayWebhook      GatewayMode = "webhook"

	PaymentPending   PaymentStatus = "pending"
	PaymentPaid      PaymentStatus = "paid"
	PaymentRejected  PaymentStatus = "rejected"
	PaymentCancelled PaymentStatus = "cancelled"
	PaymentFailed    PaymentStatus = "failed"

	ProviderPaid      ProviderEventStatus = "paid"
	ProviderFailed    ProviderEventStatus = "failed"
	ProviderCancelled ProviderEventStatus = "cancelled"
)

func ValidDiscountType(v DiscountType) bool { return v == DiscountPercentage || v == DiscountFixed }
func ValidDiscountStatus(v DiscountStatus) bool { return v == DiscountActive || v == DiscountPaused || v == DiscountExpired }
func ValidDiscountScopeType(v DiscountScopeType) bool {
	return v == DiscountScopeAll || v == DiscountScopeProduct || v == DiscountScopeProductType
}
func ValidPaymentMethod(v PaymentMethod) bool {
	return v == PaymentCard || v == PaymentTransfer || v == PaymentWallet
}
func ValidGatewayMode(v GatewayMode) bool { return v == GatewayManualReview || v == GatewayWebhook }
func ValidProviderEventStatus(v ProviderEventStatus) bool {
	return v == ProviderPaid || v == ProviderFailed || v == ProviderCancelled
}

type DiscountScope struct {
	ScopeType   DiscountScopeType `json:"scopeType"`
	ProductID   string            `json:"productId"`
	ProductType ProductType       `json:"productType"`
}

type DiscountCode struct {
	ID              string          `json:"id"`
	Code            string          `json:"code"`
	Label           string          `json:"label"`
	DiscountType    DiscountType    `json:"discountType"`
	PercentageBPS   *int            `json:"percentageBps"`
	FixedMinor      *int64          `json:"fixedMinor"`
	Status          DiscountStatus  `json:"status"`
	MinAmountMinor  int64           `json:"minAmountMinor"`
	MaxRedemptions  int             `json:"maxRedemptions"`
	ReservedCount   int             `json:"reservedCount"`
	RedeemedCount   int             `json:"redeemedCount"`
	StartsAt        *time.Time      `json:"startsAt"`
	ExpiresAt       *time.Time      `json:"expiresAt"`
	Revision        int             `json:"revision"`
	Scopes          []DiscountScope `json:"scopes"`
	CreatedAt       time.Time       `json:"createdAt"`
	UpdatedAt       time.Time       `json:"updatedAt"`
}

type DiscountWrite struct {
	Code           string          `json:"code"`
	Label          string          `json:"label"`
	DiscountType   DiscountType    `json:"discountType"`
	PercentageBPS  *int            `json:"percentageBps"`
	FixedMinor     *int64          `json:"fixedMinor"`
	Status         DiscountStatus  `json:"status"`
	MinAmountMinor int64           `json:"minAmountMinor"`
	MaxRedemptions int             `json:"maxRedemptions"`
	StartsAt       *time.Time      `json:"startsAt"`
	ExpiresAt      *time.Time      `json:"expiresAt"`
	Scopes         []DiscountScope `json:"scopes"`
}

type DiscountPage struct {
	Items   []DiscountCode `json:"items"`
	Page    int            `json:"page"`
	Limit   int            `json:"limit"`
	HasMore bool           `json:"hasMore"`
}

type DiscountPreview struct {
	Valid               bool   `json:"valid"`
	Code                string `json:"code"`
	Label               string `json:"label"`
	OriginalAmountMinor int64  `json:"originalAmountMinor"`
	DiscountAmountMinor int64  `json:"discountAmountMinor"`
	FinalAmountMinor    int64  `json:"finalAmountMinor"`
	Currency            string `json:"currency"`
	Message             string `json:"message"`
}

type CheckoutCreate struct {
	ProductID      string        `json:"productId"`
	DiscountCode   string        `json:"discountCode"`
	PaymentMethod  PaymentMethod `json:"paymentMethod"`
	IdempotencyKey string        `json:"idempotencyKey"`
}

type PaymentRequest struct {
	ID                    string        `json:"id"`
	UserID                string        `json:"userId"`
	ProductID             string        `json:"productId"`
	ProductRevision       int           `json:"productRevision"`
	ProductName           string        `json:"productName"`
	OriginalAmountMinor   int64         `json:"originalAmountMinor"`
	DiscountAmountMinor   int64         `json:"discountAmountMinor"`
	FinalAmountMinor      int64         `json:"finalAmountMinor"`
	Currency              string        `json:"currency"`
	DiscountID            string        `json:"discountId"`
	DiscountCode          string        `json:"discountCode"`
	PaymentMethod         PaymentMethod `json:"paymentMethod"`
	GatewayMode           GatewayMode   `json:"gatewayMode"`
	ProviderCode          string        `json:"providerCode"`
	Status                PaymentStatus `json:"status"`
	IdempotencyKey        string        `json:"idempotencyKey"`
	ProviderTransactionID string        `json:"providerTransactionId"`
	PaidAt                *time.Time     `json:"paidAt"`
	ReviewedBy            string        `json:"reviewedBy"`
	ReviewedAt            *time.Time     `json:"reviewedAt"`
	ReviewerNotes         string        `json:"reviewerNotes"`
	ApprovalEvidence      string        `json:"approvalEvidence"`
	Revision              int           `json:"revision"`
	CreatedAt             time.Time     `json:"createdAt"`
	UpdatedAt             time.Time     `json:"updatedAt"`
}

type PaymentRequestPage struct {
	Items   []PaymentRequest `json:"items"`
	Page    int              `json:"page"`
	Limit   int              `json:"limit"`
	HasMore bool             `json:"hasMore"`
}

type CheckoutPolicy struct {
	GatewayMode  GatewayMode
	ProviderCode string
}

type PaymentReview struct {
	ExpectedRevision int           `json:"expectedRevision"`
	Status           PaymentStatus `json:"status"`
	ReviewerNotes    string        `json:"reviewerNotes"`
	ApprovalEvidence string        `json:"approvalEvidence"`
}

type ProviderEvent struct {
	EventID          string              `json:"eventId"`
	PaymentRequestID string              `json:"paymentRequestId"`
	Status           ProviderEventStatus `json:"status"`
	AmountMinor      *int64              `json:"amountMinor"`
	Currency         string              `json:"currency"`
	TransactionID    string              `json:"transactionId"`
	OccurredAt       *time.Time          `json:"occurredAt"`
	PayloadSHA256    string              `json:"-"`
}

type ProviderEventResult struct {
	PaymentRequest PaymentRequest `json:"paymentRequest"`
	Duplicate      bool           `json:"duplicate"`
}
