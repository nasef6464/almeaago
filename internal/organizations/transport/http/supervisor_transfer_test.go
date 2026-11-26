package organizationshttp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (*repoStub) SupervisorMoveStudent(context.Context, string, string, string, org.SupervisorClassMove) (bool, error) {
	return false, org.ErrForbidden
}

func TestSupervisorTransferRequestGuards(t *testing.T) {
	const path = "/00000000-0000-0000-0000-000000000001/supervisor/students/00000000-0000-0000-0000-000000000002/class"
	const payload = `{"fromClassId":"00000000-0000-0000-0000-000000000003","classId":"00000000-0000-0000-0000-000000000004"}`
	for _, tc := range []struct {
		name string
		role identity.Role
		csrf error
		body string
		want int
	}{
		{"csrf required", identity.RoleSupervisor, identityapp.ErrCSRF, payload, http.StatusForbidden},
		{"teacher denied", identity.RoleTeacher, nil, payload, http.StatusForbidden},
		{"unknown field", identity.RoleSupervisor, nil, `{"classId":"a","fromClassId":"b","schoolId":"c"}`, http.StatusBadRequest},
		{"invalid class", identity.RoleSupervisor, nil, `{"classId":"a","fromClassId":"b"}`, http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			auth := adminAuth()
			auth.User.Roles = []identity.Role{tc.role}
			handler := New(orgapp.NewService(&repoStub{}), authStub{auth: auth, csrfErr: tc.csrf})
			req := httptest.NewRequest(http.MethodPut, path, strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			res := httptest.NewRecorder()
			handler.ServeHTTP(res, req)
			if res.Code != tc.want {
				t.Fatalf("expected %d, got %d: %s", tc.want, res.Code, res.Body)
			}
		})
	}
}
