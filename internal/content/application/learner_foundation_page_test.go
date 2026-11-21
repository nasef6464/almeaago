package application

import (
	"context"
	"errors"
	"testing"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type foundationPageRepo struct {
	*repoStub
	wrongScope bool
}

func (r *foundationPageRepo) ListLearnerFoundationPage(_ context.Context, path, subject string, page, _ int) (content.LearnerFoundationPage, error) {
	if r.wrongScope {
		subject = "other"
	}
	return content.LearnerFoundationPage{PathID: path, SubjectID: subject, Page: page, Items: []content.LearnerTopicSummary{{ID: "paid", IsLocked: true}, {ID: "free"}}, HasMore: true}, nil
}

func TestLearnerFoundationPagePreservesPriceAndAccountScope(t *testing.T) {
	repo := &foundationPageRepo{repoStub: &repoStub{}}
	access := &foundationAccessStub{allow: true}
	s := NewServiceWithAuthorScope(repo, repo, access)
	student := identity.User{ID: "student", Roles: []identity.Role{identity.RoleStudent}}
	result, err := s.LearnerFoundationPage(context.Background(), student, "path", "subject", 2, 50)
	if err != nil || result.Page != 2 || !result.HasMore || result.Items[0].IsLocked || result.Items[0].IsFree || !result.Items[1].IsFree {
		t.Fatalf("entitled: %+v %v", result, err)
	}
	result, err = s.LearnerFoundationPage(context.Background(), identity.User{}, "path", "subject", 2, 50)
	if err != nil || !result.Items[0].IsLocked || result.Items[0].IsFree {
		t.Fatalf("guest: %+v %v", result, err)
	}
	if _, err = s.LearnerFoundationPage(context.Background(), student, "path", "", 2, 50); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty subject: %v", err)
	}
	if _, err = s.LearnerFoundationPage(context.Background(), student, "path", "subject", 2, 51); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("large page: %v", err)
	}
	repo.wrongScope = true
	if _, err = s.LearnerFoundationPage(context.Background(), student, "path", "subject", 2, 50); !errors.Is(err, content.ErrConflict) {
		t.Fatalf("foreign scope: %v", err)
	}
}
