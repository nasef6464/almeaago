package organizationshttp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// Role and relationship scopes can change between requests. Their projections
// must never be reused from a browser or intermediary cache after a role,
// assignment, membership, or parent relationship is revoked.
func TestRoleScopedOrganizationReadsAreNeverCacheable(t *testing.T) {
	repo := &repoStub{
		contexts: []orgdomain.SchoolContext{{
			SchoolID: "school-1",
			Role:     identitydomain.RoleSchoolAdmin,
		}},
		teacherWorkspace: orgdomain.TeacherWorkspace{
			Schools: []orgdomain.TeacherWorkspaceSchool{{SchoolID: "school-1"}},
		},
		parentAuthority: orgdomain.ParentAuthority{
			Relationships: []orgdomain.ParentStudentRelationship{{
				ID: "relationship-1", ParentID: "parent-1",
				StudentID: "student-1", SchoolID: "school-1",
				Status: "active", Source: "admin",
			}},
		},
	}
	service := orgapp.NewService(repo)
	teacher := identityapp.Authenticated{User: identitydomain.User{
		ID: "teacher-1", Status: "active",
		Roles: []identitydomain.Role{identitydomain.RoleTeacher},
	}}
	parent := identityapp.Authenticated{User: identitydomain.User{
		ID: "parent-1", Status: "active",
		Roles: []identitydomain.Role{identitydomain.RoleParent},
	}}
	cases := []struct {
		name    string
		handler http.Handler
		path    string
		status  int
		body    string
	}{
		{
			name: "director and school membership context",
			handler: New(service, authStub{auth: schoolAdminAuth()}),
			path: "/context", status: http.StatusOK,
			body: "\"schoolId\":\"school-1\"",
		},
		{
			name: "teacher assignment and school scope",
			handler: New(service, authStub{auth: teacher}),
			path: "/teacher-workspace", status: http.StatusOK,
			body: "\"schoolId\":\"school-1\"",
		},
		{
			name: "parent child relationship scope",
			handler: NewParentFacade(service, authStub{auth: parent}),
			path: "/authority", status: http.StatusOK,
			body: "\"studentIds\":[\"student-1\"]",
		},
		{
			name: "teacher scope denied to parent",
			handler: New(service, authStub{auth: parent}),
			path: "/teacher-workspace", status: http.StatusForbidden,
		},
		{
			name: "parent scope denied to teacher",
			handler: NewParentFacade(service, authStub{auth: teacher}),
			path: "/authority", status: http.StatusForbidden,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			w := httptest.NewRecorder()
			tc.handler.ServeHTTP(w, req)
			if w.Code != tc.status {
				t.Fatalf("status=%d want=%d body=%s", w.Code, tc.status, w.Body.String())
			}
			if tc.body != "" && !strings.Contains(w.Body.String(), tc.body) {
				t.Fatalf("missing canonical scoped data %q in %s", tc.body, w.Body.String())
			}
			if got := w.Header().Get("Cache-Control"); got != "private, no-store" {
				t.Fatalf("role-scoped response must be private and uncacheable: got %q", got)
			}
		})
	}
}
