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


func (r *repoStub) CreatePath(context.Context, string, taxonomy.PathWrite) (taxonomy.Path, error) { return taxonomy.Path{}, nil }
func (r *repoStub) UpdatePath(context.Context, string, string, taxonomy.PathPatch) (taxonomy.Path, error) { return taxonomy.Path{}, nil }
func (r *repoStub) CreateLevel(context.Context, string, taxonomy.LevelWrite) (taxonomy.Level, error) { return taxonomy.Level{}, nil }
func (r *repoStub) UpdateLevel(context.Context, string, string, taxonomy.LevelPatch) (taxonomy.Level, error) { return taxonomy.Level{}, nil }
func (r *repoStub) CreateSubject(context.Context, string, taxonomy.SubjectWrite) (taxonomy.Subject, error) { return taxonomy.Subject{}, nil }
func (r *repoStub) UpdateSubject(context.Context, string, string, taxonomy.SubjectPatch) (taxonomy.Subject, error) { return taxonomy.Subject{}, nil }
func (r *repoStub) CreateSkill(context.Context, string, taxonomy.SkillWrite) (taxonomy.Skill, error) { return taxonomy.Skill{}, nil }
func (r *repoStub) UpdateSkill(context.Context, string, string, taxonomy.SkillPatch) (taxonomy.Skill, error) { return taxonomy.Skill{}, nil }

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
