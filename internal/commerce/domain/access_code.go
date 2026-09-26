package domain

import "time"

type AccessCodeStatus string

const (
	AccessCodeActive AccessCodeStatus = "active"
	AccessCodePaused AccessCodeStatus = "paused"
)

func ValidAccessCodeStatus(v AccessCodeStatus) bool {
	return v == AccessCodeActive || v == AccessCodePaused
}

type AccessCode struct {
	ID          string           `json:"id"`
	Code        string           `json:"code"`
	SchoolID    string           `json:"schoolId"`
	ProductID   string           `json:"productId"`
	Status      AccessCodeStatus `json:"status"`
	MaxUses     int              `json:"maxUses"`
	CurrentUses int              `json:"currentUses"`
	StartsAt    *time.Time       `json:"startsAt"`
	ExpiresAt   time.Time        `json:"expiresAt"`
	Revision    int              `json:"revision"`
	CreatedAt   time.Time        `json:"createdAt"`
	UpdatedAt   time.Time        `json:"updatedAt"`
}

type AccessCodeWrite struct {
	Code      string     `json:"code"`
	SchoolID  string     `json:"schoolId"`
	ProductID string     `json:"productId"`
	MaxUses   int        `json:"maxUses"`
	StartsAt  *time.Time `json:"startsAt"`
	ExpiresAt time.Time  `json:"expiresAt"`
}

type AccessCodeUpdate struct {
	ExpectedRevision int              `json:"expectedRevision"`
	Status           AccessCodeStatus `json:"status"`
	MaxUses          int              `json:"maxUses"`
	ExpiresAt        time.Time        `json:"expiresAt"`
}

type AccessCodePage struct {
	Items   []AccessCode `json:"items"`
	Page    int          `json:"page"`
	Limit   int          `json:"limit"`
	HasMore bool         `json:"hasMore"`
}

type SchoolSeat struct {
	ID             string    `json:"id"`
	SchoolID       string    `json:"schoolId"`
	ProductID      string    `json:"productId"`
	UserID         string    `json:"userId"`
	EntitlementID  string    `json:"entitlementId"`
	SourceType     string    `json:"sourceType"`
	SourceID       string    `json:"sourceId"`
	IdempotencyKey string    `json:"idempotencyKey"`
	AssignedBy     string    `json:"assignedByUserId"`
	CreatedAt      time.Time `json:"createdAt"`
}

type SchoolSeatAssign struct {
	SchoolID       string     `json:"schoolId"`
	ProductID      string     `json:"productId"`
	UserID         string     `json:"userId"`
	ExpiresAt      *time.Time `json:"expiresAt"`
	IdempotencyKey string     `json:"idempotencyKey"`
}

type SchoolSeatPage struct {
	Items   []SchoolSeat `json:"items"`
	Page    int          `json:"page"`
	Limit   int          `json:"limit"`
	HasMore bool         `json:"hasMore"`
}

type AccessCodeRedemption struct {
	AccessCode  AccessCode  `json:"accessCode"`
	SchoolSeat  SchoolSeat  `json:"schoolSeat"`
	Entitlement Entitlement `json:"entitlement"`
	Duplicate   bool        `json:"duplicate"`
}
