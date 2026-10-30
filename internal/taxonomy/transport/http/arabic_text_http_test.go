package taxonomyhttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

type arabicMutationRepo struct {
	taxonomyapp.Repository
	createCalls int
	updateCalls int
}

func (r *arabicMutationRepo) CreateSkill(_ context.Context, _ string, write taxonomy.SkillWrite) (taxonomy.Skill, error) {
	r.createCalls++
	return taxonomy.Skill{Name: write.Name, Description: write.Description}, nil
}
func (r *arabicMutationRepo) UpdateSkill(_ context.Context, _ string, _ string, patch taxonomy.SkillPatch) (taxonomy.Skill, error) {
	r.updateCalls++
	return taxonomy.Skill{}, nil
}

type arabicMutationAuth struct{ role identity.Role }

func (a arabicMutationAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: identity.User{ID: "actor-1", Roles: []identity.Role{a.role}}}, nil
}
func (a arabicMutationAuth) VerifyCSRF(_ identityapp.Authenticated, token string) error {
	if token != "valid-csrf" {
		return errors.New("invalid csrf")
	}
	return nil
}

func TestAdminArabicSkillHTTPBoundariesAndAuthorization(t *testing.T) {
	tests := []struct {
		name     string
		method   string
		role     identity.Role
		csrf     string
		value    string
		field    string
		expected int
		writes   int
	}{
		{"create 160 Arabic letters", http.MethodPost, identity.RoleAdmin, "valid-csrf", strings.Repeat("م", 160), "name", http.StatusCreated, 1},
		{"reject create 161 Arabic letters", http.MethodPost, identity.RoleAdmin, "valid-csrf", strings.Repeat("م", 161), "name", http.StatusBadRequest, 0},
		{"create 4000 Arabic description", http.MethodPost, identity.RoleAdmin, "valid-csrf", strings.Repeat("و", 4000), "description", http.StatusCreated, 1},
		{"reject create 4001 Arabic description", http.MethodPost, identity.RoleAdmin, "valid-csrf", strings.Repeat("و", 4001), "description", http.StatusBadRequest, 0},
		{"update 160 Arabic letters", http.MethodPatch, identity.RoleAdmin, "valid-csrf", strings.Repeat("م", 160), "name", http.StatusOK, 1},
		{"reject update 161 Arabic letters", http.MethodPatch, identity.RoleAdmin, "valid-csrf", strings.Repeat("م", 161), "name", http.StatusBadRequest, 0},
		{"teacher remains forbidden", http.MethodPost, identity.RoleTeacher, "valid-csrf", strings.Repeat("م", 160), "name", http.StatusForbidden, 0},
		{"CSRF remains mandatory", http.MethodPost, identity.RoleAdmin, "wrong-csrf", strings.Repeat("م", 160), "name", http.StatusForbidden, 0},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := &arabicMutationRepo{}
			handler := New(taxonomyapp.NewService(repo), arabicMutationAuth{role: tc.role})
			payload := map[string]any{tc.field: tc.value}
			path := "/admin/skills/skill-1"
			if tc.method == http.MethodPost {
				path = "/admin/skills"
				payload["subjectId"] = "subject-1"
				payload["code"] = "SK1"
				payload["kind"] = "main"
				if tc.field != "name" {
					payload["name"] = "مهارة"
				}
			}
			raw, err := json.Marshal(payload)
			if err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequest(tc.method, path, strings.NewReader(string(raw)))
			req.Header.Set("X-CSRF-Token", tc.csrf)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)
			if recorder.Code != tc.expected {
				t.Fatalf("HTTP %d, want %d: %s", recorder.Code, tc.expected, recorder.Body.String())
			}
			if got := repo.createCalls + repo.updateCalls; got != tc.writes {
				t.Fatalf("repository writes=%d, want %d", got, tc.writes)
			}
		})
	}
}
