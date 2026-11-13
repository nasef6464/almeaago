package application

import (
	"context"
	"errors"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type preparedStageStub struct {
	Repository
	calls int
}

func (s *preparedStageStub) StagePreparedQuiz(context.Context, string, string, assessment.PreparedQuizStage) error {
	s.calls++
	return nil
}

func TestPreparedQuizStagingRequiresAdminAndValidAudience(t *testing.T) {
	repo := &preparedStageStub{}
	service := &Service{repo: repo}
	id := "00000000-0000-0000-0000-000000000003"
	user := "00000000-0000-0000-0000-000000000001"
	admin := identity.User{ID: user, Roles: []identity.Role{identity.RoleAdmin}}
	teacher := identity.User{ID: user, Roles: []identity.Role{identity.RoleTeacher}}
	valid := assessment.PreparedQuizStage{Mode: "saher", AudienceType: "targeted", UserIDs: []string{user}}
	if err := service.StagePreparedQuiz(context.Background(), teacher, id, valid); !errors.Is(err, ErrForbidden) {
		t.Fatalf("teacher: %v", err)
	}
	for _, input := range []assessment.PreparedQuizStage{
		{Mode: "regular", AudienceType: "public"},
		{Mode: "saher", AudienceType: "targeted"},
		{Mode: "saher", AudienceType: "public", UserIDs: []string{user}},
		{Mode: "saher", AudienceType: "targeted", UserIDs: []string{user, user}},
		{Mode: "saher", AudienceType: "targeted", GroupIDs: []string{"not-a-uuid"}},
	} {
		if err := service.StagePreparedQuiz(context.Background(), admin, id, input); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("input %+v: %v", input, err)
		}
	}
	if repo.calls != 0 {
		t.Fatalf("invalid requests reached storage %d times", repo.calls)
	}
	if err := service.StagePreparedQuiz(context.Background(), admin, id, valid); err != nil || repo.calls != 1 {
		t.Fatalf("admin: %v calls %d", err, repo.calls)
	}
}
