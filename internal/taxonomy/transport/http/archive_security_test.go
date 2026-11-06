package taxonomyhttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
)

// mutationAuth isolates the HTTP security boundary. The nil repository is
// intentional: denied requests must not reach any persistence operation.
type mutationAuth struct {
	user identity.User
	authErr error
	csrfErr error
}

func (a mutationAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	if a.authErr != nil {
		return identityapp.Authenticated{}, a.authErr
	}
	return identityapp.Authenticated{User: a.user}, nil
}

func (a mutationAuth) VerifyCSRF(_ identityapp.Authenticated, token string) error {
	if a.csrfErr != nil || token != "valid-csrf" {
		return errors.New("invalid csrf")
	}
	return nil
}

func TestTaxonomyArchiveRestoreHTTPRejectsUnauthorizedMutations(t *testing.T) {
	const id = "00000000-0000-0000-0000-000000000801"
	for _, resource := range []string{"paths", "subjects", "levels", "skills"} {
		for _, status := range []string{"archived", "active"} {
			for _, tc := range []struct {
				name string
				auth mutationAuth
				token string
				want int
			}{
				{"no-session", mutationAuth{authErr: errors.New("no session")}, "valid-csrf", http.StatusUnauthorized},
				{"missing-csrf", mutationAuth{user: identity.User{Roles: []identity.Role{identity.RoleAdmin}}}, "", http.StatusForbidden},
				{"invalid-csrf", mutationAuth{user: identity.User{Roles: []identity.Role{identity.RoleAdmin}}}, "wrong", http.StatusForbidden},
				{"student", mutationAuth{user: identity.User{Roles: []identity.Role{identity.RoleStudent}}}, "valid-csrf", http.StatusForbidden},
				{"school-admin", mutationAuth{user: identity.User{Roles: []identity.Role{identity.RoleSchoolAdmin}}}, "valid-csrf", http.StatusForbidden},
				{"teacher", mutationAuth{user: identity.User{Roles: []identity.Role{identity.RoleTeacher}}}, "valid-csrf", http.StatusForbidden},
			} {
				t.Run(resource+"/"+status+"/"+tc.name, func(t *testing.T) {
					router := New(taxonomyapp.NewService(nil), tc.auth)
					req := httptest.NewRequest(http.MethodPatch, "/admin/"+resource+"/"+id, strings.NewReader(`{"status":"`+status+`"}`))
					req.Header.Set("Content-Type", "application/json")
					if tc.token != "" {
						req.Header.Set("X-CSRF-Token", tc.token)
					}
					rec := httptest.NewRecorder()
					router.ServeHTTP(rec, req)
					if rec.Code != tc.want {
						t.Fatalf("HTTP status=%d want=%d body=%s", rec.Code, tc.want, rec.Body.String())
					}
				})
			}
		}
	}
}
