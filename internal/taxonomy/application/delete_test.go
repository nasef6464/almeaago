package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type deletionStub struct {
	mutationRepoStub
	calls int
}

func (r *deletionStub) DeleteTaxonomy(_ context.Context, _, kind, id string) error {
	r.calls++
	return nil
}

func TestDeleteRequiresAdminAndValidTarget(t *testing.T) {
	r := &deletionStub{}
	s := NewService(r)
	if err := s.DeleteTaxonomy(context.Background(), taxonomyActor(identity.RoleStudent), "path", "id"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("student: %v", err)
	}
	if err := s.DeleteTaxonomy(context.Background(), taxonomyActor(identity.RoleAdmin), "unknown", "id"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("kind: %v", err)
	}
	if err := s.DeleteTaxonomy(context.Background(), taxonomyActor(identity.RoleAdmin), "subject", ""); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("id: %v", err)
	}
	if r.calls != 0 {
		t.Fatal("invalid request reached repository")
	}
	for _, kind := range []string{"path", "level", "subject"} {
		if err := s.DeleteTaxonomy(context.Background(), taxonomyActor(identity.RoleAdmin), kind, "id"); err != nil {
			t.Fatalf("%s: %v", kind, err)
		}
	}
	if r.calls != 3 {
		t.Fatalf("got %d calls", r.calls)
	}
}
