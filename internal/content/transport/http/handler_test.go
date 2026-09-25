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

func TestTrainerScopeMutationRequiresCSRF(t *testing.T) {
	service := contentapp.NewService(nil)
	handler := NewManagement(service, authStub{
		auth:    identityapp.Authenticated{User: identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}},
		csrfErr: errors.New("bad csrf"),
	})
	request := httptest.NewRequest(http.MethodPut, "/trainer-scopes/teacher-1", strings.NewReader(`{"pathIds":[],"subjectIds":[]}`))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", response.Code, response.Body.String())
	}
}

func TestCourseCompositionMutationRequiresCSRF(t *testing.T) {
	service := contentapp.NewService(nil)
	handler := NewCourses(service, authStub{
		auth:    identityapp.Authenticated{User: identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}},
		csrfErr: errors.New("bad csrf"),
	})
	request := httptest.NewRequest(http.MethodPost, "/course-1/modules", strings.NewReader(`{"expectedRevision":1,"title":"Module","sortOrder":0}`))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", response.Code, response.Body.String())
	}
}

func TestFoundationPlacementMutationRequiresCSRF(t *testing.T) {
	service := contentapp.NewService(nil)
	handler := NewFoundation(service, authStub{
		auth:    identityapp.Authenticated{User: identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}},
		csrfErr: errors.New("bad csrf"),
	})
	request := httptest.NewRequest(http.MethodPut, "/topics/topic-1/lessons/lesson-1", strings.NewReader(`{"expectedRevision":1,"sortOrder":0}`))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", response.Code, response.Body.String())
	}
}
