package taxonomyhttp

import (
	"context"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

type displayRedRepo struct {
	taxonomyapp.Repository
	called bool
}

func (r *displayRedRepo) UpdatePath(_ context.Context, _ string, _ string, _ taxonomy.PathPatch) (taxonomy.Path, error) {
	r.called = true
	return taxonomy.Path{ID: "p", Status: taxonomy.StatusActive}, nil
}

type displayRedAuth struct{}

func (displayRedAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: identity.User{ID: "admin", Roles: []identity.Role{identity.RoleAdmin}}}, nil
}
func (displayRedAuth) VerifyCSRF(_ identityapp.Authenticated, token string) error {
	if token != "csrf" {
		return errors.New("csrf")
	}
	return nil
}

func TestPathDisplayPatchAcceptsExplicitFalse(t *testing.T) {
	repo := &displayRedRepo{}
	handler := New(taxonomyapp.NewService(repo), displayRedAuth{})
	request := httptest.NewRequest("PATCH", "/admin/paths/p", strings.NewReader(`{"showInNavbar":false}`))
	request.Header.Set("X-CSRF-Token", "csrf")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 200 || !repo.called {
		t.Fatalf("explicit false display patch must reach the taxonomy repository: status=%d called=%v body=%s", response.Code, repo.called, response.Body.String())
	}
}
