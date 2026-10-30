package contenthttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

// Only the trainer-scope repository operations are used in this HTTP slice.
// All other Repository methods remain deliberately unimplemented.
type trainerScopeRevocationStore struct {
	contentapp.Repository
	scope  content.TrainerScope
	writes int
}

func (s *trainerScopeRevocationStore) GetTrainerScope(_ context.Context, userID string) (content.TrainerScope, error) {
	if userID != s.scope.UserID {
		return content.TrainerScope{}, content.ErrNotFound
	}
	return s.scope, nil
}

func (s *trainerScopeRevocationStore) SetTrainerScope(_ context.Context, _, userID string, paths, subjects []string) (content.TrainerScope, error) {
	s.writes++
	s.scope = content.TrainerScope{UserID: userID, PathIDs: paths, SubjectIDs: subjects}
	return s.scope, nil
}

func trainerScopeRequest(t *testing.T, h http.Handler, method, path, body string, expected int) map[string]any {
	t.Helper()
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(method, path, strings.NewReader(body)))
	if w.Code != expected {
		t.Fatalf("%s %s: want HTTP %d, got %d: %s", method, path, expected, w.Code, w.Body.String())
	}
	if got := w.Header().Get("Cache-Control"); got != "private, no-store" {
		t.Fatalf("%s %s: Cache-Control=%q; trainer assignments must not survive revocation in HTTP caches", method, path, got)
	}
	var response map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return response
}

func TestTrainerScopeHTTPNoStoreAcrossRevokeAndReload(t *testing.T) {
	store := &trainerScopeRevocationStore{scope: content.TrainerScope{
		UserID: "teacher-1", PathIDs: []string{"path-old"}, SubjectIDs: []string{"subject-old"},
	}}
	admin := identityapp.Authenticated{User: identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}}
	h := NewManagement(contentapp.NewService(store), authStub{auth: admin})
	path := "/trainer-scopes/teacher-1"

	first := trainerScopeRequest(t, h, http.MethodGet, path, "", http.StatusOK)
	before := first["scope"].(map[string]any)
	if got := before["pathIds"].([]any)[0]; got != "path-old" {
		t.Fatalf("unexpected initial scope: %v", got)
	}

	trainerScopeRequest(t, h, http.MethodPut, path, `{"pathIds":[],"subjectIds":[]}`, http.StatusOK)
	if store.writes != 1 {
		t.Fatalf("expected exactly one persisted scope mutation, got %d", store.writes)
	}
	after := trainerScopeRequest(t, h, http.MethodGet, path, "", http.StatusOK)
	scope := after["scope"].(map[string]any)
	if len(scope["pathIds"].([]any)) != 0 || len(scope["subjectIds"].([]any)) != 0 {
		t.Fatalf("revoked scope must not appear after reload: %v", scope)
	}

	// Failed edits must not change the persisted scope and must not be cacheable.
	trainerScopeRequest(t, h, http.MethodPut, path, `{"pathIds":`, http.StatusBadRequest)
	if store.writes != 1 {
		t.Fatalf("invalid payload mutated scope: %d writes", store.writes)
	}
}

func TestTrainerScopeHTTPNoStoreOnForbiddenAndCSRF(t *testing.T) {
	store := &trainerScopeRevocationStore{scope: content.TrainerScope{UserID: "teacher-1"}}
	path := "/trainer-scopes/teacher-1"
	teacher := identityapp.Authenticated{User: identity.User{ID: "teacher-2", Roles: []identity.Role{identity.RoleTeacher}}}
	hTeacher := NewManagement(contentapp.NewService(store), authStub{auth: teacher})
	trainerScopeRequest(t, hTeacher, http.MethodGet, path, "", http.StatusForbidden)
	trainerScopeRequest(t, hTeacher, http.MethodPut, path, `{"pathIds":[],"subjectIds":[]}`, http.StatusForbidden)

	admin := identityapp.Authenticated{User: identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}}
	hCSRF := NewManagement(contentapp.NewService(store), authStub{auth: admin, csrfErr: errors.New("csrf denied")})
	trainerScopeRequest(t, hCSRF, http.MethodPut, path, `{"pathIds":[],"subjectIds":[]}`, http.StatusForbidden)
	if store.writes != 0 {
		t.Fatalf("forbidden/CSRF request wrote scope: %d", store.writes)
	}
}
