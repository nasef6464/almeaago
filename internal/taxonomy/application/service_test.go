package application

import (
	"context"
	"errors"
	"testing"

	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

type repoStub struct {
	includeSkills bool
}

func (r *repoStub) PublicBootstrap(_ context.Context, includeSkills bool) (taxonomy.Bootstrap, error) {
	r.includeSkills = includeSkills
	return taxonomy.Bootstrap{}, nil
}

func TestPublicBootstrapCoreSkipsSkills(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo)
	if _, err := service.PublicBootstrap(context.Background(), "core"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.includeSkills {
		t.Fatal("core phase must not load skills")
	}
}

func TestPublicBootstrapCompactLoadsSkills(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo)
	if _, err := service.PublicBootstrap(context.Background(), "compact"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !repo.includeSkills {
		t.Fatal("compact phase must load skills")
	}
}

func TestPublicBootstrapRejectsUnknownPhase(t *testing.T) {
	service := NewService(&repoStub{})
	if _, err := service.PublicBootstrap(context.Background(), "huge"); !errors.Is(err, ErrInvalidPhase) {
		t.Fatalf("expected invalid phase, got %v", err)
	}
}
