package domain

import (
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type LinkedStudent struct {
	StudentID string   `json:"studentId"`
	Name      string   `json:"name"`
	AvatarURL string   `json:"avatarUrl"`
	SchoolIDs []string `json:"schoolIds"`
}

type ChildSummary struct {
	LinkedStudent
	WeeklyStudyMinutes    int                              `json:"weeklyStudyMinutes"`
	WeeklyAssessmentCount int                              `json:"weeklyAssessmentCount"`
	WeeklyAverageScore    float64                          `json:"weeklyAverageScore"`
	RecentResults         []assessment.ParentResultSummary `json:"recentResults"`
	WeakSkills            []learning.ParentWeakSkill       `json:"weakSkills"`
	NextAction            string                           `json:"nextAction"`
}

type DashboardSummary struct {
	TotalChildren         int     `json:"totalChildren"`
	VisibleChildren       int     `json:"visibleChildren"`
	WeeklyAssessmentCount int     `json:"weeklyAssessmentCount"`
	WeeklyAverageScore    float64 `json:"weeklyAverageScore"`
	WeakSkills            int     `json:"weakSkills"`
}

type Dashboard struct {
	Children []ChildSummary   `json:"children"`
	Summary  DashboardSummary `json:"summary"`
	Page     int              `json:"page"`
	Limit    int              `json:"limit"`
	HasMore  bool             `json:"hasMore"`
}

type WeeklyChildReport struct {
	LinkedStudent
	AssessmentCount int                        `json:"assessmentCount"`
	AverageScore    float64                    `json:"averageScore"`
	StudyMinutes    int                        `json:"studyMinutes"`
	WeakSkills      []learning.ParentWeakSkill `json:"weakSkills"`
	NextAction      string                     `json:"nextAction"`
}

type WeeklyReport struct {
	PeriodStart time.Time           `json:"periodStart"`
	PeriodEnd   time.Time           `json:"periodEnd"`
	Children    []WeeklyChildReport `json:"children"`
	Page        int                 `json:"page"`
	Limit       int                 `json:"limit"`
	HasMore     bool                `json:"hasMore"`
}

type PaymentApproval struct {
	ID                   string    `json:"id"`
	StudentID            string    `json:"studentId"`
	StudentName          string    `json:"studentName"`
	ProductID            string    `json:"productId"`
	ProductName          string    `json:"productName"`
	ProductType          string    `json:"productType"`
	FinalAmountMinor     int64     `json:"finalAmountMinor"`
	Currency             string    `json:"currency"`
	Status               string    `json:"status"`
	ParentApprovalStatus string    `json:"parentApprovalStatus"`
	Revision             int       `json:"revision"`
	CreatedAt            time.Time `json:"createdAt"`
}

type WeeklyReportSendResult struct {
	OK               bool   `json:"ok"`
	CampaignID       string `json:"campaignId,omitempty"`
	Recipients       int    `json:"recipients"`
	Created          int    `json:"created"`
	StudentsReported int    `json:"studentsReported"`
	Message          string `json:"message,omitempty"`
}

type UnlinkStudentResult struct {
	StudentID string `json:"studentId"`
	Message   string `json:"message"`
}
