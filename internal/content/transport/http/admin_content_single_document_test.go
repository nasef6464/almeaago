package contenthttp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

// Admin content writes must consume exactly one JSON document. A successful
// first decode cannot authorize a write while trailing bytes remain unread.
func TestAdminContentDecodeJSONRequiresSingleDocument(t *testing.T) {
	tests := []struct {
		name   string
		body   string
		wantOK bool
	}{
		{name: "single document", body: `{"title":"درس"}`, wantOK: true},
		{name: "single document with whitespace", body: "  \n" + `{"title":"درس"}` + "\n\t", wantOK: true},
		{name: "two objects", body: `{"title":"درس"} {"title":"آخر"}`, wantOK: false},
		{name: "trailing null", body: `{"title":"درس"} null`, wantOK: false},
		{name: "trailing array", body: `{"title":"درس"} []`, wantOK: false},
		{name: "trailing scalar", body: `{"title":"درس"} 123`, wantOK: false},
		{name: "trailing garbage", body: `{"title":"درس"} !`, wantOK: false},
		{name: "unknown field", body: `{"title":"درس","unexpected":true}`, wantOK: false},
		{name: "invalid first document", body: `{"title":`, wantOK: false},
		{name: "empty body", body: "", wantOK: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/lessons", strings.NewReader(tc.body))
			rec := httptest.NewRecorder()
			var dst struct {
				Title string `json:"title"`
			}
			got := decodeJSON(rec, req, &dst)
			if got != tc.wantOK {
				t.Fatalf("decodeJSON(%q): got ok=%v HTTP=%d body=%q; want ok=%v", tc.body, got, rec.Code, rec.Body.String(), tc.wantOK)
			}
			if !tc.wantOK && rec.Code != http.StatusBadRequest {
				t.Fatalf("invalid payload must return HTTP 400, got %d", rec.Code)
			}
			if tc.wantOK && dst.Title != "درس" {
				t.Fatalf("valid Arabic content changed: %q", dst.Title)
			}
		})
	}
}


// Exercise the real HTTP routes with no backing service. Invalid trailing
// documents must be rejected before any domain mutation can be invoked.
func TestAdminContentMutationRoutesRejectTrailingDocumentsBeforeService(t *testing.T) {
	admin := authStub{auth: identityapp.Authenticated{User: identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}}}
	tests := []struct {
		name    string
		method  string
		path    string
		handler http.Handler
	}{
		{name: "create course", method: http.MethodPost, path: "/", handler: NewCourses(nil, admin)},
		{name: "create lesson", method: http.MethodPost, path: "/", handler: NewLessons(nil, admin)},
		{name: "create library item", method: http.MethodPost, path: "/", handler: NewLibrary(nil, admin)},
		{name: "create foundation topic", method: http.MethodPost, path: "/topics", handler: NewFoundation(nil, admin)},
		{name: "trainer scope", method: http.MethodPut, path: "/trainer-scopes/teacher-1", handler: NewManagement(nil, admin)},
		{name: "course module", method: http.MethodPost, path: "/course-1/modules", handler: NewCourses(nil, admin)},
		{name: "foundation lesson placement", method: http.MethodPut, path: "/topics/topic-1/lessons/lesson-1", handler: NewFoundation(nil, admin)},
		{name: "course publication", method: http.MethodPatch, path: "/course-1/publication", handler: NewCourses(nil, admin)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(`{} {}`))
			req.Header.Set("X-CSRF-Token", "valid-test-token")
			rec := httptest.NewRecorder()
			tc.handler.ServeHTTP(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("want HTTP 400 before any service mutation, got %d: %s", rec.Code, rec.Body.String())
			}
		})
	}
}
