package taxonomyhttp

import (
	"context"
	"net/http"
	"strings"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

type sectionHTTPRepo struct {
	*taxonomyHTTPRepo
	writes int
}

func (r *sectionHTTPRepo) CreateSkillSection(_ context.Context, _ string, input taxonomy.SkillSectionWrite) (taxonomy.SkillSection, error) {
	r.writes++
	return taxonomy.SkillSection{ID: "00000000-0000-0000-0000-000000000003", SubjectID: input.SubjectID, Name: input.Name, Status: taxonomy.StatusActive}, nil
}
func (r *sectionHTTPRepo) UpdateSkillSection(_ context.Context, _, id string, input taxonomy.SkillSectionPatch) (taxonomy.SkillSection, error) {
	r.writes++
	return taxonomy.SkillSection{ID: id, Status: taxonomy.Status(*input.Status)}, nil
}
func (r *sectionHTTPRepo) SetSkillSection(_ context.Context, _, id, section string) (taxonomy.Skill, error) {
	r.writes++
	return taxonomy.Skill{ID: id, SectionID: section, Kind: "main"}, nil
}

func TestSkillSectionHTTPAuthorizationAndMutations(t *testing.T) {
	const subject = "00000000-0000-0000-0000-000000000001"
	const section = "00000000-0000-0000-0000-000000000002"
	const skill = "00000000-0000-0000-0000-000000000003"
	create := `{"subjectId":"` + subject + `","name":"قسم","sortOrder":1}`
	for _, tc := range []struct {
		name   string
		auth   taxonomyHTTPAuth
		csrf   string
		status int
	}{
		{"anonymous", taxonomyHTTPAuth{unauth: true}, "valid-csrf", http.StatusUnauthorized},
		{"missing csrf", taxonomyHTTPAuth{role: identity.RoleAdmin}, "", http.StatusForbidden},
		{"teacher", taxonomyHTTPAuth{role: identity.RoleTeacher}, "valid-csrf", http.StatusForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &sectionHTTPRepo{taxonomyHTTPRepo: &taxonomyHTTPRepo{}}
			h := New(taxonomyapp.NewService(repo), tc.auth)
			rec := taxonomyHTTPCall(h, http.MethodPost, "/admin/skill-sections", create, tc.csrf)
			if rec.Code != tc.status || repo.writes != 0 {
				t.Fatalf("%d %s writes %d", rec.Code, rec.Body, repo.writes)
			}
		})
	}
	repo := &sectionHTTPRepo{taxonomyHTTPRepo: &taxonomyHTTPRepo{}}
	h := New(taxonomyapp.NewService(repo), taxonomyHTTPAuth{role: identity.RoleAdmin})
	if rec := taxonomyHTTPCall(h, http.MethodPost, "/admin/skill-sections", create, "valid-csrf"); rec.Code != http.StatusCreated || !strings.Contains(rec.Body.String(), `"subjectId"`) {
		t.Fatalf("create %d %s", rec.Code, rec.Body)
	}
	if rec := taxonomyHTTPCall(h, http.MethodPatch, "/admin/skill-sections/"+section, `{"status":"archived"}`, "valid-csrf"); rec.Code != http.StatusOK {
		t.Fatalf("archive %d %s", rec.Code, rec.Body)
	}
	if rec := taxonomyHTTPCall(h, http.MethodPut, "/admin/skills/"+skill+"/section", `{"sectionId":""}`, "valid-csrf"); rec.Code != http.StatusOK {
		t.Fatalf("clear %d %s", rec.Code, rec.Body)
	}
	if rec := taxonomyHTTPCall(h, http.MethodPut, "/admin/skills/"+skill+"/section", `{}`, "valid-csrf"); rec.Code != http.StatusBadRequest {
		t.Fatalf("missing section %d", rec.Code)
	}
	if repo.writes != 3 {
		t.Fatalf("writes %d", repo.writes)
	}
}
