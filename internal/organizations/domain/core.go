package domain

import (
	"encoding/json"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type SchoolStatus string

const (
	SchoolStatusActive    SchoolStatus = "active"
	SchoolStatusSuspended SchoolStatus = "suspended"
	SchoolStatusArchived  SchoolStatus = "archived"
)

type ClassStatus string

const (
	ClassStatusActive   ClassStatus = "active"
	ClassStatusArchived ClassStatus = "archived"
)

type AccessContext struct {
	ActorUserID string
	ActorRoles  []identity.Role
}

type School struct {
	ID        string
	Code      string
	Name      string
	Status    SchoolStatus
	Metadata  json.RawMessage
	CreatedAt time.Time
	UpdatedAt time.Time
}

type SchoolListQuery struct {
	Page   int
	Limit  int
	Search string
	Status *SchoolStatus
}

type SchoolPage struct {
	Schools []School
	Page    int
	Limit   int
	Total   int
}

type SchoolWrite struct {
	Code     string
	Name     string
	Status   SchoolStatus
	Metadata json.RawMessage
}

type SchoolPatch struct {
	Name     *string
	Status   *SchoolStatus
	Metadata *json.RawMessage
}

type Class struct {
	ID        string
	SchoolID  string
	Code      string
	Name      string
	Status    ClassStatus
	Metadata  json.RawMessage
	CreatedAt time.Time
	UpdatedAt time.Time
}

type ClassListQuery struct {
	Page   int
	Limit  int
	Search string
	Status *ClassStatus
}

type ClassPage struct {
	Classes []Class
	Page    int
	Limit   int
	Total   int
}

type ClassWrite struct {
	Code     string
	Name     string
	Status   ClassStatus
	Metadata json.RawMessage
}

type ClassPatch struct {
	Name     *string
	Status   *ClassStatus
	Metadata *json.RawMessage
}

type RosterQuery struct {
	Page    int
	Limit   int
	Search  string
	Role    *identity.Role
	ClassID string
	Active  *bool
}

type RosterMember struct {
	UserID   string
	Name     string
	Email    string
	Status   string
	Role     identity.Role
	ClassIDs []string
}

type RosterPage struct {
	Members []RosterMember
	Page    int
	Limit   int
	Total   int
}

func ValidSchoolStatus(status SchoolStatus) bool {
	switch status {
	case SchoolStatusActive, SchoolStatusSuspended, SchoolStatusArchived:
		return true
	default:
		return false
	}
}

func ValidClassStatus(status ClassStatus) bool {
	switch status {
	case ClassStatusActive, ClassStatusArchived:
		return true
	default:
		return false
	}
}
