package domain

import (
	"errors"
	"time"
)

var (
	ErrNotFound        = errors.New("commerce record not found")
	ErrConflict        = errors.New("commerce state conflict")
	ErrVersionConflict = errors.New("commerce version conflict")
)

type ProductType string
type ProductStatus string
type AccessMode string
type PackageKind string
type PackageScopeType string
type ContentType string
type SubjectType string
type EntitlementStatus string

const (
	ProductCourse     ProductType = "course"
	ProductPackage    ProductType = "package"
	ProductMembership ProductType = "membership"

	ProductActive   ProductStatus = "active"
	ProductInactive ProductStatus = "inactive"
	ProductArchived ProductStatus = "archived"

	AccessFree AccessMode = "free"
	AccessPaid AccessMode = "paid"

	PackageBundle     PackageKind = "bundle"
	PackageMembership PackageKind = "membership"
	PackageSchool     PackageKind = "school"

	ScopeCourse      PackageScopeType = "course"
	ScopePath        PackageScopeType = "path"
	ScopeSubject     PackageScopeType = "subject"
	ScopeContentType PackageScopeType = "content_type"
	ScopeAll         PackageScopeType = "all"

	ContentCourses    ContentType = "courses"
	ContentFoundation ContentType = "foundation"
	ContentBanks      ContentType = "banks"
	ContentTests      ContentType = "tests"
	ContentMockExams  ContentType = "mock_exams"
	ContentLibrary    ContentType = "library"
	ContentAll        ContentType = "all"

	SubjectUser   SubjectType = "user"
	SubjectSchool SubjectType = "school"

	EntitlementActive  EntitlementStatus = "active"
	EntitlementRevoked EntitlementStatus = "revoked"
	EntitlementExpired EntitlementStatus = "expired"
)

func ValidProductType(v ProductType) bool {
	return v == ProductCourse || v == ProductPackage || v == ProductMembership
}
func ValidProductStatus(v ProductStatus) bool {
	return v == ProductActive || v == ProductInactive || v == ProductArchived
}
func ValidAccessMode(v AccessMode) bool { return v == AccessFree || v == AccessPaid }
func ValidPackageKind(v PackageKind) bool {
	return v == PackageBundle || v == PackageMembership || v == PackageSchool
}
func ValidScopeType(v PackageScopeType) bool {
	return v == ScopeCourse || v == ScopePath || v == ScopeSubject || v == ScopeContentType || v == ScopeAll
}
func ValidContentType(v ContentType) bool {
	return v == ContentCourses || v == ContentFoundation || v == ContentBanks || v == ContentTests || v == ContentMockExams || v == ContentLibrary || v == ContentAll
}
func ValidSubjectType(v SubjectType) bool { return v == SubjectUser || v == SubjectSchool }

type PackageItem struct {
	ScopeType   PackageScopeType `json:"scopeType"`
	CourseID    string           `json:"courseId"`
	PathID      string           `json:"pathId"`
	SubjectID   string           `json:"subjectId"`
	ContentType ContentType      `json:"contentType"`
}

type Package struct {
	ID           string        `json:"id"`
	ProductID    string        `json:"productId"`
	PackageKind  PackageKind   `json:"packageKind"`
	SeatCapacity *int          `json:"seatCapacity"`
	ValidityDays *int          `json:"validityDays"`
	Items        []PackageItem `json:"items,omitempty"`
}

type Product struct {
	ID          string        `json:"id"`
	Code        string        `json:"code"`
	ProductType ProductType   `json:"productType"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Status      ProductStatus `json:"status"`
	AccessMode  AccessMode    `json:"accessMode"`
	PriceMinor  int64         `json:"priceMinor"`
	Currency    string        `json:"currency"`
	CourseID    string        `json:"courseId"`
	IsVisible   bool          `json:"isVisible"`
	Revision    int           `json:"revision"`
	Package     *Package      `json:"package,omitempty"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

type ProductWrite struct {
	Code        string        `json:"code"`
	ProductType ProductType   `json:"productType"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Status      ProductStatus `json:"status"`
	AccessMode  AccessMode    `json:"accessMode"`
	PriceMinor  int64         `json:"priceMinor"`
	Currency    string        `json:"currency"`
	CourseID    string        `json:"courseId"`
	IsVisible   bool          `json:"isVisible"`
	Package     *PackageWrite `json:"package,omitempty"`
}

type PackageWrite struct {
	PackageKind  PackageKind   `json:"packageKind"`
	SeatCapacity *int          `json:"seatCapacity"`
	ValidityDays *int          `json:"validityDays"`
	Items        []PackageItem `json:"items"`
}

type ProductPage struct {
	Items   []Product `json:"items"`
	Page    int       `json:"page"`
	Limit   int       `json:"limit"`
	HasMore bool      `json:"hasMore"`
}

type Entitlement struct {
	ID              string            `json:"id"`
	SubjectType     SubjectType       `json:"subjectType"`
	UserID          string            `json:"userId"`
	SchoolID        string            `json:"schoolId"`
	ProductID       string            `json:"productId"`
	SourceType      string            `json:"sourceType"`
	SourceID        string            `json:"sourceId"`
	Status          EntitlementStatus `json:"status"`
	GrantedByUserID string            `json:"grantedByUserId"`
	StartsAt        time.Time         `json:"startsAt"`
	ExpiresAt       *time.Time        `json:"expiresAt"`
	RevokedAt       *time.Time        `json:"revokedAt"`
	RevokeReason    string            `json:"revokeReason"`
	IdempotencyKey  string            `json:"idempotencyKey"`
	Revision        int               `json:"revision"`
	CreatedAt       time.Time         `json:"createdAt"`
	UpdatedAt       time.Time         `json:"updatedAt"`
}

type EntitlementGrant struct {
	SubjectType    SubjectType `json:"subjectType"`
	UserID         string      `json:"userId"`
	SchoolID       string      `json:"schoolId"`
	ProductID      string      `json:"productId"`
	StartsAt       *time.Time  `json:"startsAt"`
	ExpiresAt      *time.Time  `json:"expiresAt"`
	IdempotencyKey string      `json:"idempotencyKey"`
}

type EntitlementPage struct {
	Items   []Entitlement `json:"items"`
	Page    int           `json:"page"`
	Limit   int           `json:"limit"`
	HasMore bool          `json:"hasMore"`
}

type AccessDecision struct {
	Allowed           bool   `json:"allowed"`
	Configured        bool   `json:"configured"`
	Reason            string `json:"reason"`
	ProductID         string `json:"productId"`
	EntitlementID     string `json:"entitlementId"`
	EntitlementSource string `json:"entitlementSource"`
}
