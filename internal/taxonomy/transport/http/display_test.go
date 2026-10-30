package taxonomyhttp

import (
	"context"
	"encoding/json"
	"errors"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBootstrapProjectsOriginalDisplayFields(t *testing.T) {
	var value taxonomy.Bootstrap
	// Decode the domain shape without requiring new members to exist for the RED test.
	json.Unmarshal([]byte(`{"Paths":[{"ID":"p","Status":"active","ShowInNavbar":false,"Settings":{"ShowMockExamCard":false}}],"Subjects":[{"ID":"s","Icon":"🧪","Color":"#abcdef"}]}`), &value)
	for _, present := range []func(taxonomy.Bootstrap) map[string]any{presentBootstrap, presentAdminBootstrap} {
		b, _ := json.Marshal(present(value))
		var got map[string][]map[string]any
		json.Unmarshal(b, &got)
		p := got["paths"][0]
		if p["showInNavbar"] != false || p["isActive"] != true {
			t.Fatalf("missing path display: %s", b)
		}
		if got["subjects"][0]["icon"] != "🧪" || got["subjects"][0]["color"] != "#abcdef" {
			t.Fatalf("missing subject display: %s", b)
		}
	}
}

type displayRepo struct {
	taxonomyapp.Repository
	patch taxonomy.PathPatch
}

func (r *displayRepo) UpdatePath(_ context.Context, _ string, _ string, p taxonomy.PathPatch) (taxonomy.Path, error) {
	r.patch = p
	return taxonomy.Path{ID: "p", Status: taxonomy.StatusActive, ShowInNavbar: p.ShowInNavbar, Settings: *p.Settings}, nil
}

type displayAuth struct{}

func (displayAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: identity.User{ID: "actor", Roles: []identity.Role{identity.RoleAdmin}}}, nil
}
func (displayAuth) VerifyCSRF(_ identityapp.Authenticated, token string) error {
	if token != "csrf" {
		return errors.New("csrf")
	}
	return nil
}
func TestPathDisplayPatchHTTPPreservesFalseAndProjectsMutation(t *testing.T) {
	repo := &displayRepo{}
	handler := New(taxonomyapp.NewService(repo), displayAuth{})
	request := httptest.NewRequest("PATCH", "/admin/paths/p", strings.NewReader(`{"showInNavbar":false,"settings":{"showMockExamCard":false}}`))
	request.Header.Set("X-CSRF-Token", "csrf")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 200 {
		t.Fatalf("%d: %s", response.Code, response.Body.String())
	}
	if repo.patch.ShowInNavbar == nil || *repo.patch.ShowInNavbar || repo.patch.Settings == nil || repo.patch.Settings.ShowMockExamCard == nil || *repo.patch.Settings.ShowMockExamCard {
		t.Fatalf("false patch lost: %+v", repo.patch)
	}
	var got struct{ Path map[string]any }
	json.Unmarshal(response.Body.Bytes(), &got)
	if got.Path["showInNavbar"] != false || got.Path["isActive"] != true || got.Path["id"] != "p" {
		t.Fatalf("wrong mutation projection: %s", response.Body.String())
	}
	request = httptest.NewRequest("PATCH", "/admin/paths/p", strings.NewReader(`{"showInNavbar":false}`))
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 403 {
		t.Fatalf("CSRF bypass: %d", response.Code)
	}
}

type navigationRepo struct {
	taxonomyapp.Repository
	privileged bool
}

func (r *navigationRepo) PublicBootstrap(context.Context, bool) (taxonomy.Bootstrap, error) {
	r.privileged = false
	return taxonomy.Bootstrap{Paths: []taxonomy.Path{{ID: "active", Status: taxonomy.StatusActive}}}, nil
}
func (r *navigationRepo) AdminBootstrap(context.Context) (taxonomy.Bootstrap, error) {
	r.privileged = true
	return taxonomy.Bootstrap{Paths: []taxonomy.Path{{ID: "inactive", Status: taxonomy.StatusInactive}, {ID: "archived", Status: taxonomy.StatusArchived}}}, nil
}

type navigationAuth struct {
	role    identity.Role
	invalid bool
}

func (a navigationAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	if a.invalid {
		return identityapp.Authenticated{}, errors.New("expired")
	}
	return identityapp.Authenticated{User: identity.User{ID: "actor", Roles: []identity.Role{a.role}}}, nil
}
func (navigationAuth) VerifyCSRF(identityapp.Authenticated, string) error { return nil }
func TestOptionalSessionTaxonomyReadRoleAndCache(t *testing.T) {
	for _, role := range []identity.Role{identity.RoleAdmin, identity.RoleTeacher, identity.RoleSupervisor, identity.RoleStudent, identity.RoleSchoolAdmin, identity.RoleParent} {
		t.Run(string(role), func(t *testing.T) {
			for _, invalid := range []bool{false, true} {
				repo := &navigationRepo{}
				handler := New(taxonomyapp.NewService(repo), navigationAuth{role: role, invalid: invalid})
				request := httptest.NewRequest("GET", "/bootstrap?phase=core", nil)
				if invalid {
					request.AddCookie(&http.Cookie{Name: "almeaa_access_token", Value: "expired-session"})
				} else {
					request.Header.Set("Authorization", "Bearer session")
				}
				response := httptest.NewRecorder()
				handler.ServeHTTP(response, request)
				privileged := !invalid && role == identity.RoleAdmin
				if response.Code != 200 || repo.privileged != privileged {
					t.Fatalf("invalid=%v status=%d privileged=%v wanted=%v", invalid, response.Code, repo.privileged, privileged)
				}
				if privileged && response.Header().Get("Cache-Control") != "private, no-store" {
					t.Fatalf("staff cache leak: %v", response.Header())
				}
				if !strings.Contains(response.Header().Get("Vary"), "Cookie") || !strings.Contains(response.Header().Get("Vary"), "Authorization") {
					t.Fatalf("missing session vary: %v", response.Header())
				}
			}
		})
	}
	repo := &navigationRepo{}
	handler := New(taxonomyapp.NewService(repo), navigationAuth{role: identity.RoleAdmin})
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest("GET", "/bootstrap?phase=core", nil))
	if repo.privileged {
		t.Fatal("anonymous request used staff projection")
	}
}
