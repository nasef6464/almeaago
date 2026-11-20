package domain

import (
	"errors"
	"fmt"
	"time"
)

var ErrPreparedQuizAccessDenied = errors.New("prepared quiz audience access denied")

// PreparedQuizStage is an inactive administrative draft, never a grant of
// access. Enabling it requires enforcement across all start paths.
type PreparedQuizStage struct {
	Mode         string                    `json:"mode"`
	AudienceType string                    `json:"audienceType"`
	DueExclusive *time.Time                `json:"dueExclusive,omitempty"`
	UserIDs      []string                  `json:"userIds"`
	GroupIDs     []string                  `json:"groupIds"`
	Enabled      bool                      `json:"-"`
	WasEnabled   bool                      `json:"-"`
	TargetUsers  []PreparedQuizGroupMember `json:"-"`
}

type PreparedQuizGroup struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	GroupType   string `json:"groupType"`
	LegacyID    string `json:"legacyId,omitempty"`
	MemberCount int    `json:"memberCount"`
}

type PreparedQuizGroupMember struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type PreparedQuizCard struct {
	ID            string     `json:"id"`
	Title         string     `json:"title"`
	SubjectName   string     `json:"subjectName"`
	Mode          string     `json:"mode"`
	QuestionCount int        `json:"questionCount"`
	DueExclusive  *time.Time `json:"dueExclusive,omitempty"`
}

// PreparedQuizDeadline converts the legacy date-only due date into the first
// instant of the following local day, including daylight-saving changes.
func PreparedQuizDeadline(date string, zone *time.Location) (*time.Time, error) {
	if date == "" {
		return nil, nil
	}
	if zone == nil {
		return nil, fmt.Errorf("prepared quiz deadline requires a platform timezone")
	}
	day, err := time.ParseInLocation("2006-01-02", date, zone)
	if err != nil {
		return nil, fmt.Errorf("invalid prepared quiz due date: %w", err)
	}
	next := day.AddDate(0, 0, 1)
	return &next, nil
}

// PreparedQuizAudience is the distribution contract for legacy prepared
// quizzes. Group IDs refer to platform groups, not school classes.
type PreparedQuizAudience struct {
	Published      bool
	Quiz           bool
	StandaloneMock bool
	Mode           string
	QuestionCount  int
	DueExclusive   *time.Time
	TargetUserIDs  []string
	TargetGroupIDs []string
}

// PreparedQuizEligible must be used by both listing and starting a prepared
// quiz. The deadline is exclusive: the legacy date is converted to midnight
// of the following day in the configured platform timezone by the caller.
func PreparedQuizEligible(q PreparedQuizAudience, studentID string, studentGroupIDs []string, now time.Time) bool {
	if studentID == "" || !q.Published || !q.Quiz || q.StandaloneMock || (q.Mode != "saher" && q.Mode != "central") || q.QuestionCount <= 0 {
		return false
	}
	if q.DueExclusive != nil && !now.Before(*q.DueExclusive) {
		return false
	}
	if len(q.TargetUserIDs) == 0 && len(q.TargetGroupIDs) == 0 {
		return true
	}
	for _, id := range q.TargetUserIDs {
		if id == studentID {
			return true
		}
	}
	for _, target := range q.TargetGroupIDs {
		for _, group := range studentGroupIDs {
			if target != "" && target == group {
				return true
			}
		}
	}
	return false
}
