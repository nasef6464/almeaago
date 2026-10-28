package contenthttp

import (
	"context"
	"errors"
	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"net/http/httptest"
	"strings"
	"testing"
)

type homepageAuth struct {
	authStub
	session error
}

func (a homepageAuth) Authenticate(ctx context.Context, raw string) (identityapp.Authenticated, error) {
	if a.session != nil {
		return identityapp.Authenticated{}, a.session
	}
	return a.authStub.Authenticate(ctx, raw)
}

type homepageStore struct{}

func (homepageStore) GetHomepageSettings(context.Context) (content.HomepageSettings, error) {
	return nil, nil
}
func (homepageStore) PatchHomepageSettings(context.Context, string, content.HomepageSettings) (content.HomepageSettings, error) {
	panic("invalid/unauthorized payload reached repository")
}
func TestHomepageHTTPBoundaries(t *testing.T) {
	for _, tc := range []struct {
		name, method, body string
		role               identity.Role
		csrf, session      error
		want               int
	}{
		{name: "guest read", method: "GET", session: errors.New("no session"), want: 200},
		{name: "anonymous write", method: "PATCH", body: `{}`, session: errors.New("no session"), want: 401},
		{name: "student malformed body", method: "PATCH", body: `[`, role: identity.RoleStudent, want: 403},
		{name: "student write", method: "PATCH", body: `{}`, role: identity.RoleStudent, want: 403},
		{name: "csrf", method: "PATCH", body: `{}`, role: identity.RoleAdmin, csrf: errors.New("csrf"), want: 403},
		{name: "bad field", method: "PATCH", body: `{"hero":{"rotateIntervalSeconds":61}}`, role: identity.RoleAdmin, want: 400},
		{name: "null", method: "PATCH", body: `null`, role: identity.RoleAdmin, want: 400},
		{name: "trailing", method: "PATCH", body: `{} {}`, role: identity.RoleAdmin, want: 400},
		{name: "oversize", method: "PATCH", body: `{"unknown":"` + strings.Repeat("a", 5<<20) + `"}`, role: identity.RoleAdmin, want: 413},
	} {
		t.Run(tc.name, func(t *testing.T) {
			handler := NewManagementWithPresentation(nil, homepageAuth{authStub: authStub{auth: identityapp.Authenticated{User: identity.User{Roles: []identity.Role{tc.role}}}, csrfErr: tc.csrf}, session: tc.session}, nil, contentapp.NewHomepageService(homepageStore{}))
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(tc.method, "/homepage-settings", strings.NewReader(tc.body)))
			if response.Code != tc.want {
				t.Fatalf("want %d got %d %s", tc.want, response.Code, response.Body.String())
			}
			if response.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("settings response must not cache stale administrative state")
			}
		})
	}
}
