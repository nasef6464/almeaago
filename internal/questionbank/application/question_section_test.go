package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type questionSectionStub struct {
	Repository
	calls int
	last  string
}

func (r *questionSectionStub) GetQuestionSection(context.Context, string) (string, error) {
	r.calls++
	return "section", nil
}
func (r *questionSectionStub) SetQuestionSection(_ context.Context, _, _, section string) error {
	r.calls++
	r.last = section
	return nil
}

func TestQuestionSectionRequiresAdminAndValidIdentifiers(t *testing.T) {
	repo := &questionSectionStub{}
	service := NewService(repo)
	admin := identity.User{ID: "00000000-0000-0000-0000-000000000001", Roles: []identity.Role{identity.RoleAdmin}}
	student := identity.User{ID: "00000000-0000-0000-0000-000000000002", Roles: []identity.Role{identity.RoleStudent}}
	id := "00000000-0000-0000-0000-000000000003"
	if _, err := service.QuestionSection(context.Background(), student, id); !errors.Is(err, ErrForbidden) {
		t.Fatalf("student read: %v", err)
	}
	if err := service.SetQuestionSection(context.Background(), student, id, ""); !errors.Is(err, ErrForbidden) {
		t.Fatalf("student write: %v", err)
	}
	if err := service.SetQuestionSection(context.Background(), admin, id, "not-a-uuid"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid section: %v", err)
	}
	if repo.calls != 0 {
		t.Fatalf("unauthorized repository calls: %d", repo.calls)
	}
	if err := service.SetQuestionSection(context.Background(), admin, id, ""); err != nil || repo.calls != 1 || repo.last != "" {
		t.Fatalf("clear: %v %+v", err, repo)
	}
}

func TestCreateQuestionPassesSectionOnlyForAdmin(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo)
	input := CreateInput{QuestionCode: "Q-SECTION", SectionID: "00000000-0000-0000-0000-000000000004", Version: baseVersion()}
	if _, err := service.Create(context.Background(), actor(identity.RoleTeacher), input); !errors.Is(err, ErrForbidden) {
		t.Fatalf("teacher section: %v", err)
	}
	if _, err := service.Create(context.Background(), actor(identity.RoleAdmin), input); err != nil {
		t.Fatal(err)
	}
	if repo.create.SectionID != input.SectionID {
		t.Fatalf("section missing from create command: %+v", repo.create)
	}
	input.SectionID = "invalid"
	if _, err := service.Create(context.Background(), actor(identity.RoleAdmin), input); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid section: %v", err)
	}
}
