package domain

import (
	"time"
)

type SchoolInquiry struct {
	ID                  string    `json:"id"`
	RefNumber           string    `json:"refNumber"`
	SchoolName          string    `json:"schoolName"`
	City                string    `json:"city"`
	DirectorName        string    `json:"directorName"`
	Phone               string    `json:"phone"`
	Email               string    `json:"email"`
	StudentCount        int       `json:"studentCount"`
	TierID              string    `json:"tierId"`
	TierName            string    `json:"tierName"`
	Paths               []string  `json:"paths"`
	Notes               string    `json:"notes"`
	TotalAnnualEstimate float64   `json:"totalAnnualEstimate"`
	CreatedAt           time.Time `json:"createdAt"`
}

type SchoolInquiryCreate struct {
	RefNumber           string   `json:"refNumber"`
	SchoolName          string   `json:"schoolName"`
	City                string   `json:"city"`
	DirectorName        string   `json:"directorName"`
	Phone               string   `json:"phone"`
	Email               string   `json:"email"`
	StudentCount        int      `json:"studentCount"`
	TierID              string   `json:"tierId"`
	TierName            string   `json:"tierName"`
	Paths               []string `json:"paths"`
	Notes               string   `json:"notes"`
	TotalAnnualEstimate float64  `json:"totalAnnualEstimate"`
}
