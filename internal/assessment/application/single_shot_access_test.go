package application

import (
	"context"
	"errors"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

type securedSingleShotRepo struct {
	*fakeAttemptRepo
	scope            assessment.AccessContext
	replay           bool
	replayOwner      string
	replayAssessment string
	strict           bool
	calls            int
}

func (r *securedSingleShotRepo) GetSingleShotAccessContext(_ context.Context, id string) (assessment.AccessContext, bool, error) {
	if id != "quiz-code" {
		return assessment.AccessContext{}, false, assessment.ErrNotFound
	}
	return r.scope, r.strict, nil
}
func (r *securedSingleShotRepo) FindSingleShotResult(_ context.Context, student, id, key string) (assessment.ResultDetail, bool, error) {
	if r.replay && student == r.replayOwner && id == r.replayAssessment && key == "retry" {
		return assessment.ResultDetail{AssessmentID: "quiz-code"}, true, nil
	}
	return assessment.ResultDetail{}, false, nil
}
func (r *securedSingleShotRepo) SingleShotSubmit(_ context.Context, _, _ string, _ assessment.SingleShotSubmissionRequest) (assessment.ResultDetail, error) {
	r.calls++
	return assessment.ResultDetail{AssessmentID: "quiz-code"}, nil
}

func TestSingleShotChecksAccessAndAllowsOwnedRetry(t *testing.T) {
	for _, policy := range []assessment.AccessType{assessment.AccessPaid, assessment.AccessPrivate, assessment.AccessCourseOnly} {
		t.Run(string(policy), func(t *testing.T) {
			repo := &securedSingleShotRepo{fakeAttemptRepo: &fakeAttemptRepo{}, scope: assessment.AccessContext{AssessmentKind: assessment.KindNormal, BaseAccess: policy, PathID: "path", SubjectID: "subject"}}
			access := &recordingCommerceAccess{commerceAccessStub: commerceAccessStub{allowed: false, reason: "paid_required"}}
			s := NewAttemptServiceWithLearningAndCommerce(repo, nil, access)
			_, err := s.SingleShotSubmit(context.Background(), student("owner"), "quiz-code", assessment.SingleShotSubmissionRequest{SubmissionKey: "first"})
			if !errors.Is(err, ErrForbidden) || repo.calls != 0 {
				t.Fatalf("locked assessment submitted: err=%v calls=%d", err, repo.calls)
			}
			repo.replay = true
			repo.replayOwner = "owner"
			repo.replayAssessment = "quiz-code"
			if _, err = s.SingleShotSubmit(context.Background(), student("owner"), "quiz-code", assessment.SingleShotSubmissionRequest{SubmissionKey: "retry"}); err != nil {
				t.Fatalf("owned completed retry: %v", err)
			}
			if _, err = s.SingleShotSubmit(context.Background(), student("other"), "quiz-code", assessment.SingleShotSubmissionRequest{SubmissionKey: "retry"}); !errors.Is(err, ErrForbidden) {
				t.Fatalf("other student accessed retry: %v", err)
			}
		})
	}
	repo := &securedSingleShotRepo{fakeAttemptRepo: &fakeAttemptRepo{}, scope: assessment.AccessContext{AssessmentKind: assessment.KindNormal, BaseAccess: assessment.AccessFree}}
	if _, err := NewAttemptService(repo).SingleShotSubmit(context.Background(), student("owner"), "quiz-code", assessment.SingleShotSubmissionRequest{}); err != nil || repo.calls != 1 {
		t.Fatalf("free quiz code failed: err=%v calls=%d", err, repo.calls)
	}
	repo.scope.AssessmentKind = assessment.KindMock
	repo.strict = true
	repo.calls = 0
	if _, err := NewAttemptService(repo).SingleShotSubmit(context.Background(), student("owner"), "quiz-code", assessment.SingleShotSubmissionRequest{}); !errors.Is(err, ErrForbidden) || repo.calls != 0 {
		t.Fatalf("strict mock bypassed its section runner: err=%v calls=%d", err, repo.calls)
	}
}
