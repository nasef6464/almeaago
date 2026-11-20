package application

import (
	"context"
	"errors"
	"strings"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type singleShotCaptureRepo struct {
	*fakeAttemptRepo
	calls    int
	captured assessment.SingleShotSubmissionRequest
}

func (r *singleShotCaptureRepo) SingleShotSubmit(_ context.Context, _, _ string, req assessment.SingleShotSubmissionRequest) (assessment.ResultDetail, error) {
	r.calls++
	r.captured = req
	return assessment.ResultDetail{}, nil
}

type unusedEvidenceSink struct{}

func (unusedEvidenceSink) ApplyAssessmentSubmission(context.Context, learning.SubmissionEvidence) error {
	return nil
}

func TestSingleShotValidatesAndCopiesAnswers(t *testing.T) {
	for _, tc := range []struct {
		name string
		req  assessment.SingleShotSubmissionRequest
	}{
		{"oversized key", assessment.SingleShotSubmissionRequest{SubmissionKey: strings.Repeat("x", 161), Answers: map[string]int{"q": 0}}},
		{"negative time", assessment.SingleShotSubmissionRequest{SubmissionKey: "key", TimeSpentSeconds: -1}},
		{"duplicate normalized ids", assessment.SingleShotSubmissionRequest{SubmissionKey: "key", Answers: map[string]int{"q": 0, " q ": 1}}},
		{"invalid option", assessment.SingleShotSubmissionRequest{SubmissionKey: "key", Answers: map[string]int{"q": -2}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := &singleShotCaptureRepo{fakeAttemptRepo: &fakeAttemptRepo{}}
			_, err := NewAttemptService(r).SingleShotSubmit(context.Background(), student("student-1"), "assessment-1", tc.req)
			if !errors.Is(err, ErrInvalidInput) || r.calls != 0 {
				t.Fatalf("err=%v writes=%d", err, r.calls)
			}
		})
	}
	r := &singleShotCaptureRepo{fakeAttemptRepo: &fakeAttemptRepo{}}
	original := map[string]int{" q ": 1, "unanswered": -1}
	_, err := NewAttemptService(r).SingleShotSubmit(context.Background(), student("student-1"), "assessment-1", assessment.SingleShotSubmissionRequest{SubmissionKey: " key ", Answers: original})
	if err != nil || r.calls != 1 || r.captured.SubmissionKey != "key" || r.captured.Answers["q"] != 1 || len(r.captured.Answers) != 1 || original[" q "] != 1 || original["unanswered"] != -1 {
		t.Fatalf("err=%v captured=%+v original=%v", err, r.captured, original)
	}
}

func TestSingleShotMissingEvidenceSourceFailsBeforeWrite(t *testing.T) {
	r := &singleShotCaptureRepo{fakeAttemptRepo: &fakeAttemptRepo{}}
	_, err := NewAttemptServiceWithLearning(r, unusedEvidenceSink{}).SingleShotSubmit(context.Background(), student("student-1"), "assessment-1", assessment.SingleShotSubmissionRequest{SubmissionKey: "key"})
	if err == nil || r.calls != 0 {
		t.Fatalf("err=%v writes=%d", err, r.calls)
	}
}
