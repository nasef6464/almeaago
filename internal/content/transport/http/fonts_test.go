package contenthttp

import (
	"errors"
	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFontMutationBoundariesBeforeRepository(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		role       identity.Role
		csrf       error
		want       int
	}{
		{"student", `{}`, identity.RoleStudent, nil, 403},
		{"teacher", `{}`, identity.RoleTeacher, nil, 403},
		{"csrf", `{}`, identity.RoleAdmin, errors.New("bad csrf"), 403},
		{"invalid", `{"bodyFont":"serif"}`, identity.RoleAdmin, nil, 400},
		{"null", `null`, identity.RoleAdmin, nil, 400},
		{"trailing", `{} {}`, identity.RoleAdmin, nil, 400},
		{"oversize", `{"junk":"` + strings.Repeat("x", 1500000) + `"}`, identity.RoleAdmin, nil, 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			handler := NewManagement(nil, authStub{auth: identityapp.Authenticated{User: identity.User{Roles: []identity.Role{tc.role}}}, csrfErr: tc.csrf}, contentapp.NewFontService(nil))
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(http.MethodPatch, "/platform-font-settings", strings.NewReader(tc.body)))
			if response.Code != tc.want {
				t.Fatalf("want %d got %d: %s", tc.want, response.Code, response.Body.String())
			}
		})
	}
}
