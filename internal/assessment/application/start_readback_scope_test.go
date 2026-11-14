package application

import (
	"context"
	"errors"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

type directStartReadbackRepo struct {
	*fakeAttemptRepo
	existing assessment.Attempt
}

func (r *directStartReadbackRepo) FindDirectStart(context.Context, string, string, string) (assessment.Attempt, bool, error) {
	return r.existing, true, nil
}

func TestDirectStartRejectsMismatchedReadback(t *testing.T) {
	cases := []struct {
		name, studentID, assessmentID string
		forbidden                     bool
	}{
		{"owned attempt", "student-1", "assessment-1", false},
		{"other student", "student-2", "assessment-1", true},
		{"other assessment", "student-1", "assessment-2", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &directStartReadbackRepo{fakeAttemptRepo: &fakeAttemptRepo{}, existing: assessment.Attempt{StudentID: tc.studentID, AssessmentID: tc.assessmentID}}
			_, err := NewAttemptService(repo).Start(context.Background(), student("student-1"), "assessment-1", "retry-key")
			if tc.forbidden && !errors.Is(err, ErrForbidden) {
				t.Fatalf("expected forbidden, got %v", err)
			}
			if !tc.forbidden && err != nil {
				t.Fatalf("expected owned attempt, got %v", err)
			}
		})
	}
}
