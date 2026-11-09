package application

import (
	"context"
	"errors"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"testing"
)

type libraryAccessStub struct {
	courseAccessStub
	allowed       bool
	err           error
	calls         int
	path, subject string
}

func (a *libraryAccessStub) CheckLibraryAccess(_ context.Context, _ string, path, subject string) (commerce.AccessDecision, error) {
	a.calls++
	a.path = path
	a.subject = subject
	return commerce.AccessDecision{Allowed: a.allowed}, a.err
}
func TestLibraryAccessProtectsLinksAndUsesExactEntitlement(t *testing.T) {
	student := identity.User{ID: "student", Roles: []identity.Role{identity.RoleStudent}}
	access := &libraryAccessStub{}
	s := NewServiceWithAuthorScope(&repoStub{}, &repoStub{}, access)
	items := func() []content.LearnerLibrarySummary {
		return []content.LearnerLibrarySummary{{ID: "free", ExternalURL: "free-url"}, {ID: "paid", IsLocked: true, ExternalURL: "secret-url"}}
	}
	rows := items()
	if err := s.applyLibraryAccess(context.Background(), student, "path", "subject", rows); err != nil || rows[0].ExternalURL != "free-url" || rows[1].ExternalURL != "" || !rows[1].IsLocked {
		t.Fatalf("denied: %+v %v", rows, err)
	}
	access.allowed = true
	rows = items()
	if err := s.applyLibraryAccess(context.Background(), student, "path", "subject", rows); err != nil || rows[1].ExternalURL != "secret-url" || rows[1].IsLocked || access.path != "path" || access.subject != "subject" {
		t.Fatalf("entitled: %+v %v", rows, err)
	}
	access.err = errors.New("offline")
	rows = items()
	if err := s.applyLibraryAccess(context.Background(), student, "path", "subject", rows); err == nil || rows[1].ExternalURL != "" {
		t.Fatalf("failure must not expose: %+v %v", rows, err)
	}
}

func TestGuestSeesLibraryEntriesWithoutOpeningLinks(t *testing.T) {
	rows := []content.LearnerLibrarySummary{{ID: "free", ExternalURL: "free-url"}, {ID: "locked", IsLocked: true, ExternalURL: "paid-url"}}
	s := NewService(&repoStub{})
	if err := s.applyLibraryAccess(context.Background(), identity.User{}, "path", "subject", rows); err != nil || rows[0].ExternalURL != "" || rows[1].ExternalURL != "" || rows[0].IsLocked || !rows[1].IsLocked {
		t.Fatalf("guest should see entries but not receive their links: %+v %v", rows, err)
	}
}
