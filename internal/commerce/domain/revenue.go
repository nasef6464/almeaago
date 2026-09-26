package domain

import "time"

type RevenueAllocationStatus string
type PayoutStatus string

const (
	RevenueNotApplicable RevenueAllocationStatus = "not_applicable"
	RevenuePolicyMissing RevenueAllocationStatus = "policy_missing"
	RevenuePending       RevenueAllocationStatus = "pending"
	RevenueAllocated     RevenueAllocationStatus = "allocated"

	PayoutNotApplicable PayoutStatus = "not_applicable"
	PayoutPending       PayoutStatus = "pending"
	PayoutPaid          PayoutStatus = "paid"
)

type RevenuePolicySnapshot struct {
	CourseID               string
	TrainerUserID           string
	RevenueSharePercentage *float64
}

type RevenueEntry struct {
	ID                     string                  `json:"id"`
	PaymentRequestID       string                  `json:"paymentRequestId"`
	ProductID              string                  `json:"productId"`
	ProductType            ProductType             `json:"productType"`
	CourseID               string                  `json:"courseId"`
	BuyerUserID            string                  `json:"buyerUserId"`
	TrainerUserID          string                  `json:"trainerUserId"`
	RevenueSharePercentage *float64                `json:"revenueSharePercentage"`
	GrossAmountMinor       int64                   `json:"grossAmountMinor"`
	DiscountAmountMinor    int64                   `json:"discountAmountMinor"`
	PaidAmountMinor        int64                   `json:"paidAmountMinor"`
	Currency               string                  `json:"currency"`
	ProviderFeeMinor       *int64                  `json:"providerFeeMinor"`
	TrainerShareMinor      *int64                  `json:"trainerShareMinor"`
	PlatformShareMinor     *int64                  `json:"platformShareMinor"`
	AllocationStatus       RevenueAllocationStatus `json:"allocationStatus"`
	PayoutStatus           PayoutStatus            `json:"payoutStatus"`
	AllocationEvidence     string                  `json:"allocationEvidence"`
	AllocatedBy            string                  `json:"allocatedBy"`
	AllocatedAt            *time.Time              `json:"allocatedAt"`
	PayoutEvidence         string                  `json:"payoutEvidence"`
	PaidBy                 string                  `json:"paidBy"`
	PayoutPaidAt           *time.Time              `json:"payoutPaidAt"`
	Revision               int                     `json:"revision"`
	CreatedAt              time.Time               `json:"createdAt"`
	UpdatedAt              time.Time               `json:"updatedAt"`
}

type RevenueEntryPage struct {
	Items   []RevenueEntry `json:"items"`
	Page    int            `json:"page"`
	Limit   int            `json:"limit"`
	HasMore bool           `json:"hasMore"`
}

type RevenueAllocation struct {
	ExpectedRevision   int    `json:"expectedRevision"`
	ProviderFeeMinor   int64  `json:"providerFeeMinor"`
	TrainerShareMinor  int64  `json:"trainerShareMinor"`
	PlatformShareMinor int64  `json:"platformShareMinor"`
	Evidence           string `json:"evidence"`
}

type PayoutMarkPaid struct {
	ExpectedRevision int    `json:"expectedRevision"`
	Evidence         string `json:"evidence"`
}
