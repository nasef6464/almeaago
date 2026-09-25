package contenthttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type authStub struct {
	auth    identityapp.Authenticated
	csrfErr error
}

func (a authStub) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return a.auth, nil
}
func (a authStub) VerifyCSRF(identityapp.Authenticated, string) error { return a.csrfErr }

func TestCourseMutationRequiresCSRF(t *testing.T) {
	service := contentapp.NewService(nil)
	handler := NewCourses(service, authStub{
		auth:    identityapp.Authenticated{User: identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}},
		csrfErr: errors.New("bad csrf"),
	})
	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"pathId":"x"}`))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", response.Code, response.Body.String())
	}
}

func TestCourseListRejectsInvalidPaginationBeforeRepository(t *testing.T) {
	service := contentapp.NewService(nil)
	handler := NewCourses(service, authStub{
		auth: identityapp.Authenticated{User: identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}},
	})
	request := httptest.NewRequest(http.MethodGet, "/?limit=0", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", response.Code, response.Body.String())
	}
}
