package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
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
	for _, kind := range []string{"path", "level", "subject", "skill", "skill_section"} {
		if err := s.DeleteTaxonomy(context.Background(), taxonomyActor(identity.RoleAdmin), kind, "id"); err != nil {
			t.Fatalf("%s: %v", kind, err)
		}
	}
	if r.calls != 5 {
		t.Fatalf("got %d calls", r.calls)
	}
}

type bulkDeletionStub struct {
	mutationRepoStub
	failID string
}

func (r *bulkDeletionStub) DeleteTaxonomy(_ context.Context, _, _, id string) error {
	if id == r.failID {
		return taxonomy.ErrConflict
	}
	return nil
}

func TestBulkDeleteTaxonomy(t *testing.T) {
	s := NewService(&bulkDeletionStub{failID: "sk-2"})
	res, err := s.BulkDeleteTaxonomy(context.Background(), taxonomyActor(identity.RoleAdmin), "skill", []string{"sk-1", "sk-2", "sk-1", "sk-3"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res.DeletedIDs) != 2 || res.DeletedIDs[0] != "sk-1" || res.DeletedIDs[1] != "sk-3" {
		t.Fatalf("unexpected deletedIDs: %+v", res.DeletedIDs)
	}
	if len(res.Blocked) != 1 || res.Blocked[0].ID != "sk-2" {
		t.Fatalf("unexpected blocked: %+v", res.Blocked)
	}
}
