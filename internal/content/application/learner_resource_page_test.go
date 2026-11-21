package application

import (
	"context"
	"errors"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"testing"
)

type resourcePageRepo struct {
	*repoStub
	wrongScope bool
}

func (r *resourcePageRepo) ListLearnerResourcePage(_ context.Context, path, subject, _ string, page, _ int) (content.LearnerResourcePage, error) {
	if r.wrongScope {
		subject = "other"
	}
	return content.LearnerResourcePage{PathID: path, SubjectID: subject, Page: page, HasMore: true, Library: []content.LearnerLibrarySummary{{ID: "free", ExternalURL: "free-url"}, {ID: "paid", IsLocked: true, ExternalURL: "paid-url"}}}, nil
}
func TestLearnerResourcePageProtectsLibraryAndScope(t *testing.T) {
	repo := &resourcePageRepo{repoStub: &repoStub{}}
	access := &libraryAccessStub{}
	s := NewServiceWithAuthorScope(repo, repo, access)
	student := identity.User{ID: "student", Roles: []identity.Role{identity.RoleStudent}}
	guest, err := s.LearnerResourcePage(context.Background(), identity.User{}, "path", "subject", "library", 2, 50)
	if err != nil || guest.Library[0].ExternalURL != "" || guest.Library[1].ExternalURL != "" || !guest.Library[1].IsLocked {
		t.Fatalf("guest: %+v %v", guest, err)
	}
	denied, err := s.LearnerResourcePage(context.Background(), student, "path", "subject", "library", 2, 50)
	if err != nil || denied.Library[0].ExternalURL != "free-url" || denied.Library[1].ExternalURL != "" {
		t.Fatalf("denied: %+v %v", denied, err)
	}
	access.allowed = true
	allowed, err := s.LearnerResourcePage(context.Background(), student, "path", "subject", "library", 2, 50)
	if err != nil || allowed.Library[1].ExternalURL != "paid-url" || allowed.Library[1].IsLocked || access.path != "path" || access.subject != "subject" {
		t.Fatalf("allowed: %+v %v", allowed, err)
	}
	if _, err = s.LearnerResourcePage(context.Background(), student, "path", "subject", "invalid", 2, 50); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid kind: %v", err)
	}
	repo.wrongScope = true
	if _, err = s.LearnerResourcePage(context.Background(), student, "path", "subject", "library", 2, 50); !errors.Is(err, content.ErrConflict) {
		t.Fatalf("wrong scope: %v", err)
	}
}
