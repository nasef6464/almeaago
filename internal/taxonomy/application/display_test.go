package application

import (
	"context"
	"encoding/json"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
	"testing"
)

func TestDisplayOnlyPatchesPreserveFalseEmptyAndOmission(t *testing.T) {
	s := NewService(&mutationRepoStub{})
	var p taxonomy.PathPatch
	if err := json.Unmarshal([]byte(`{"showInNavbar":false,"settings":{"showMockExamCard":false}}`), &p); err != nil {
		t.Fatal(err)
	}
	if _, err := s.UpdatePath(context.Background(), taxonomyActor(identity.RoleAdmin), "path", p); err != nil {
		t.Fatalf("display-only false rejected: %v", err)
	}
	var sub taxonomy.SubjectPatch
	if err := json.Unmarshal([]byte(`{"icon":"","color":""}`), &sub); err != nil {
		t.Fatal(err)
	}
	if _, err := s.UpdateSubject(context.Background(), taxonomyActor(identity.RoleAdmin), "subject", sub); err != nil {
		t.Fatalf("display-only empty rejected: %v", err)
	}
}

type displayCaptureRepo struct {
	mutationRepoStub
	path    taxonomy.PathPatch
	subject taxonomy.SubjectPatch
}

func (r *displayCaptureRepo) UpdatePath(_ context.Context, _ string, _ string, p taxonomy.PathPatch) (taxonomy.Path, error) {
	r.path = p
	return taxonomy.Path{}, nil
}
func (r *displayCaptureRepo) UpdateSubject(_ context.Context, _ string, _ string, p taxonomy.SubjectPatch) (taxonomy.Subject, error) {
	r.subject = p
	return taxonomy.Subject{}, nil
}
func TestDisplayPatchPassesExplicitValuesAndKeepsOmissions(t *testing.T) {
	repo := &displayCaptureRepo{}
	s := NewService(repo)
	actor := taxonomyActor(identity.RoleAdmin)
	no := false
	empty := ""
	name := "Renamed"
	if _, err := s.UpdatePath(context.Background(), actor, "p", taxonomy.PathPatch{ShowInNavbar: &no}); err != nil {
		t.Fatal(err)
	}
	if repo.path.ShowInNavbar == nil || *repo.path.ShowInNavbar || repo.path.Settings != nil {
		t.Fatal("false or omitted settings lost")
	}
	if _, err := s.UpdateSubject(context.Background(), actor, "s", taxonomy.SubjectPatch{Icon: &empty}); err != nil {
		t.Fatal(err)
	}
	if repo.subject.Icon == nil || *repo.subject.Icon != "" || repo.subject.Color != nil {
		t.Fatal("empty or omitted color lost")
	}
	if _, err := s.UpdatePath(context.Background(), actor, "p", taxonomy.PathPatch{Name: &name}); err != nil {
		t.Fatal(err)
	}
	if repo.path.ShowInNavbar != nil || repo.path.Settings != nil {
		t.Fatal("name patch invented presentation")
	}
}

func TestEnrollmentDisplaySettingsValidateOriginalOptions(t *testing.T) {
	s := NewService(&mutationRepoStub{})
	actor := taxonomyActor(identity.RoleAdmin)
	for _, body := range []string{`{"showInHome":false}`, `{"settings":{"stageSelection":"auto"}}`, `{"settings":{"stageSelection":"required","stageLabel":" المرحلة "}}`, `{"settings":{"stageSelection":"none"}}`} {
		var patch taxonomy.PathPatch
		if err := json.Unmarshal([]byte(body), &patch); err != nil {
			t.Fatal(err)
		}
		if _, err := s.UpdatePath(context.Background(), actor, "p", patch); err != nil {
			t.Fatalf("source input %s rejected: %v", body, err)
		}
	}
	for _, body := range []string{`{"name":"x","settings":{"stageSelection":"invented"}}`, `{"name":"x","settings":{"stageLabel":" "}}`} {
		var patch taxonomy.PathPatch
		json.Unmarshal([]byte(body), &patch)
		if _, err := s.UpdatePath(context.Background(), actor, "p", patch); err != ErrInvalidInput {
			t.Fatalf("invalid source setting %s accepted: %v", body, err)
		}
	}
}
