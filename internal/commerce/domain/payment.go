package domain

import "time"

type DiscountType string
type DiscountStatus string
type PaymentMethod string
type PaymentStatus string
type GatewayMode string
type ProviderEventStatus string

const (
	DiscountPercentage DiscountType = "percentage"
	DiscountFixed      DiscountType = "fixed"

	DiscountActive  DiscountStatus = "active"
	DiscountPaused  DiscountStatus = "paused"
	DiscountExpired DiscountStatus = "expired"

	PaymentCard     PaymentMethod = "card"
	PaymentTransfer PaymentMethod = "transfer"
	PaymentWallet   PaymentMethod = "wallet"

	PaymentPending   PaymentStatus = "pending"
	PaymentApproved  PaymentStatus = "approved"
	PaymentRejected  PaymentStatus = "rejected"
	PaymentCancelled PaymentStatus = "cancelled"

	GatewayManualReview GatewayMode = "manual_review"
	GatewayWebhook      GatewayMode = "webhook"
	GatewayPaymentLink  GatewayMode = "payment_link"

	ProviderPaid      ProviderEventStatus = "paid"
	ProviderFailed    ProviderEventStatus = "failed"
	ProviderCancelled ProviderEventStatus = "cancelled"
)

func ValidDiscountType(v DiscountType) bool { return v == DiscountPercentage || v == DiscountFixed }
func ValidDiscountStatus(v DiscountStatus) bool { return v == DiscountActive || v == DiscountPaused || v == DiscountExpired }
func ValidPaymentMethod(v PaymentMethod) bool { return v == PaymentCard || v == PaymentTransfer || v == PaymentWallet }
func ValidPaymentStatus(v PaymentStatus) bool { return v == PaymentPending || v == PaymentApproved || v == PaymentRejected || v == PaymentCancelled }
func ValidReviewTarget(v PaymentStatus) bool { return v == PaymentApproved || v == PaymentRejected || v == PaymentCancelled }
func ValidProviderEventStatus(v ProviderEventStatus) bool { return v == ProviderPaid || v == ProviderFailed || v == ProviderCancelled }

type DiscountCode struct {
	ID                 string          `json:"id"`
	Code               string          `json:"code"`
	Label              string          `json:"label"`
	Type               DiscountType    `json:"type"`
	Value              int64           `json:"value"`
	Currency           string          `json:"currency"`
	Status             DiscountStatus  `json:"status"`
	ProductID          string          `json:"productId"`
	ProductType        ProductType     `json:"productType"`
	MinAmountMinor     int64           `json:"minAmountMinor"`
	MaxRedemptions     int             `json:"maxRedemptions"`
	CurrentRedemptions int             `json:"currentRedemptions"`
	StartsAt           *time.Time      `json:"startsAt"`
	ExpiresAt          *time.Time      `json:"expiresAt"`
	Revision           int             `json:"revision"`
	CreatedAt          time.Time       `json:"createdAt"`
	UpdatedAt          time.Time       `json:"updatedAt"`
}

type DiscountWrite struct {
	Code           string         `json:"code"`
	Label          string         `json:"label"`
	Type           DiscountType   `json:"type"`
	Value          int64          `json:"value"`
	Currency       string         `json:"currency"`
	Status         DiscountStatus `json:"status"`
	ProductID      string         `json:"productId"`
	ProductType    ProductType    `json:"productType"`
	MinAmountMinor int64          `json:"minAmountMinor"`
	MaxRedemptions int            `json:"maxRedemptions"`
	StartsAt       *time.Time     `json:"startsAt"`
	ExpiresAt      *time.Time     `json:"expiresAt"`
}

type DiscountPage struct {
	Items   []DiscountCode `json:"items"`
	Page    int            `json:"page"`
	Limit   int            `json:"limit"`
	HasMore bool           `json:"hasMore"`
}

type CheckoutQuote struct {
	ProductID           string      `json:"productId"`
	ProductName         string      `json:"productName"`
	ProductType         ProductType `json:"productType"`
	CourseID            string      `json:"courseId"`
	ProductRevision     int         `json:"productRevision"`
	OriginalAmountMinor int64       `json:"originalAmountMinor"`
	DiscountCode        string      `json:"discountCode"`
	DiscountAmountMinor int64       `json:"discountAmountMinor"`
	FinalAmountMinor    int64       `json:"finalAmountMinor"`
	Currency            string      `json:"currency"`
}

type PaymentRequestCreate struct {
	ProductID         string        `json:"productId"`
	DiscountCode      string        `json:"discountCode"`
	PaymentMethod     PaymentMethod `json:"paymentMethod"`
	PaymentCountry    string        `json:"paymentCountry"`
	TransferReference string        `json:"transferReference"`
	WalletNumber      string        `json:"walletNumber"`
	Notes             string        `json:"notes"`
	IdempotencyKey    string        `json:"idempotencyKey"`
}

type PaymentRequest struct {
	ID                  string        `json:"id"`
	UserID              string        `json:"userId"`
	ProductID           string        `json:"productId"`
	ProductRevision     int           `json:"productRevision"`
	ProductName         string        `json:"productName"`
	ProductType         ProductType   `json:"productType"`
	OriginalAmountMinor int64         `json:"originalAmountMinor"`
	DiscountAmountMinor int64         `json:"discountAmountMinor"`
	FinalAmountMinor    int64         `json:"finalAmountMinor"`
	Currency            string        `json:"currency"`
	DiscountCodeID      string        `json:"discountCodeId"`
	DiscountCode        string        `json:"discountCode"`
	PaymentMethod       PaymentMethod `json:"paymentMethod"`
	ProviderCode        string        `json:"providerCode"`
	GatewayMode         GatewayMode   `json:"gatewayMode"`
	PaymentCountry      string        `json:"paymentCountry"`
	TransferReference   string        `json:"transferReference"`
	WalletNumber        string        `json:"walletNumber"`
	Notes               string        `json:"notes"`
	Status              PaymentStatus `json:"status"`
	ReviewerNotes       string        `json:"reviewerNotes"`
	ApprovalEvidence    string        `json:"approvalEvidence"`
	ReviewedBy          string        `json:"reviewedBy"`
	ReviewedAt          *time.Time     `json:"reviewedAt"`
	ProviderTransaction string        `json:"providerTransactionId"`
	ProviderEventID     string        `json:"providerEventId"`
	PaidAt              *time.Time     `json:"paidAt"`
	IdempotencyKey      string         `json:"idempotencyKey"`
	Revision            int            `json:"revision"`
	CreatedAt           time.Time      `json:"createdAt"`
	UpdatedAt           time.Time      `json:"updatedAt"`
}

type PaymentRequestPage struct {
	Items   []PaymentRequest `json:"items"`
	Page    int              `json:"page"`
	Limit   int              `json:"limit"`
	HasMore bool             `json:"hasMore"`
}

type PaymentReview struct {
	ExpectedRevision int           `json:"expectedRevision"`
	Status           PaymentStatus `json:"status"`
	ReviewerNotes    string        `json:"reviewerNotes"`
	ApprovalEvidence string        `json:"approvalEvidence"`
}

type ProviderEventInput struct {
	ProviderCode     string              `json:"providerCode"`
	EventID          string              `json:"eventId"`
	PaymentRequestID string              `json:"paymentRequestId"`
	Status           ProviderEventStatus `json:"status"`
	AmountMinor      int64               `json:"amountMinor"`
	Currency         string              `json:"currency"`
	TransactionID    string              `json:"transactionId"`
	OccurredAt       *time.Time           `json:"occurredAt"`
	PayloadSHA256    string              `json:"-"`
}

type ProviderEventResult struct {
	EventID          string         `json:"eventId"`
	Duplicate        bool           `json:"duplicate"`
	Accepted         bool           `json:"accepted"`
	ProcessingStatus string         `json:"processingStatus"`
	PaymentRequest   PaymentRequest `json:"paymentRequest"`
	EntitlementID    string         `json:"entitlementId"`
}
