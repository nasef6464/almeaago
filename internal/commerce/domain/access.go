package domain

import "time"

type AccessCodeStatus string
type SchoolSeatStatus string

const (
	AccessCodeActive   AccessCodeStatus = "active"
	AccessCodePaused   AccessCodeStatus = "paused"
	AccessCodeArchived AccessCodeStatus = "archived"

	SchoolSeatActive  SchoolSeatStatus = "active"
	SchoolSeatRevoked SchoolSeatStatus = "revoked"
)

func ValidAccessCodeStatus(v AccessCodeStatus) bool {
	return v == AccessCodeActive || v == AccessCodePaused || v == AccessCodeArchived
}

type AccessCode struct {
	ID          string           `json:"id"`
	Code        string           `json:"code"`
	ProductID   string           `json:"productId"`
	SchoolID    string           `json:"schoolId"`
	Status      AccessCodeStatus `json:"status"`
	MaxUses     int              `json:"maxUses"`
	CurrentUses int              `json:"currentUses"`
	StartsAt    time.Time        `json:"startsAt"`
	ExpiresAt   time.Time        `json:"expiresAt"`
	Revision    int              `json:"revision"`
	CreatedAt   time.Time        `json:"createdAt"`
	UpdatedAt   time.Time        `json:"updatedAt"`
}

type AccessCodeCreate struct {
	Code      string     `json:"code"`
	ProductID string     `json:"productId"`
	SchoolID  string     `json:"schoolId"`
	MaxUses   int        `json:"maxUses"`
	StartsAt  *time.Time `json:"startsAt"`
	ExpiresAt time.Time  `json:"expiresAt"`
}

type AccessCodePage struct {
	Items   []AccessCode `json:"items"`
	Page    int          `json:"page"`
	Limit   int          `json:"limit"`
	HasMore bool         `json:"hasMore"`
}

type AccessCodeRedemption struct {
	AccessCode  AccessCode  `json:"accessCode"`
	Entitlement Entitlement `json:"entitlement"`
}

type SchoolSeatAssignment struct {
	ID                  string           `json:"id"`
	SchoolEntitlementID string           `json:"schoolEntitlementId"`
	UserID              string           `json:"userId"`
	UserEntitlementID   string           `json:"userEntitlementId"`
	Status              SchoolSeatStatus `json:"status"`
	Revision            int              `json:"revision"`
	RevokedAt           *time.Time       `json:"revokedAt"`
	RevokeReason        string           `json:"revokeReason"`
	CreatedAt           time.Time        `json:"createdAt"`
	UpdatedAt           time.Time        `json:"updatedAt"`
}

type SchoolSeatPage struct {
	Items   []SchoolSeatAssignment `json:"items"`
	Page    int                    `json:"page"`
	Limit   int                    `json:"limit"`
	HasMore bool                   `json:"hasMore"`
}
