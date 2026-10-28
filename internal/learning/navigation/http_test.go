package navigation

import (
	"context"
	"errors"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeRepo struct {
	actor  string
	writes int
}

func (r *fakeRepo) Get(_ context.Context, id string) (Preferences, error) {
	r.actor = id
	return Empty(), nil
}
func (r *fakeRepo) Patch(_ context.Context, id string, _ bool, _ Patch) (Preferences, error) {
	r.actor = id
	r.writes++
	return Empty(), nil
}

type fakeAuth struct{ denied, csrf bool }

func (a fakeAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	if a.denied {
		return identityapp.Authenticated{}, errors.New("no")
	}
	return identityapp.Authenticated{User: identity.User{ID: "session-actor"}}, nil
}
func (a fakeAuth) VerifyCSRF(identityapp.Authenticated, string) error {
	if !a.csrf {
		return errors.New("csrf")
	}
	return nil
}
func TestHTTPActorCSRFAndStrictShapes(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		auth       fakeAuth
		want       int
	}{
		{"actor injection", `{"actorId":"other"}`, fakeAuth{csrf: true}, 400},
		{"false", `{"enrolledPaths":false}`, fakeAuth{csrf: true}, 400},
		{"null", `{"enrolledPaths":null}`, fakeAuth{csrf: true}, 400},
		{"csrf", `{}`, fakeAuth{}, 403},
		{"unauthenticated", `{}`, fakeAuth{denied: true}, 401},
		{"session actor", `{"enrolledPaths":[]}`, fakeAuth{csrf: true}, 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeRepo{}
			w := httptest.NewRecorder()
			NewHandler(NewService(repo), tc.auth).ServeHTTP(w, httptest.NewRequest(http.MethodPatch, "/", strings.NewReader(tc.body)))
			if w.Code != tc.want {
				t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
			}
			if tc.want == 200 && (repo.actor != "session-actor" || repo.writes != 1) {
				t.Fatalf("wrong actor: %+v", repo)
			}
			if tc.want != 200 && repo.writes != 0 {
				t.Fatal("invalid request wrote")
			}
		})
	}
}
func TestServiceRejectsMissingActor(t *testing.T) {
	r := &fakeRepo{}
	_, err := NewService(r).Patch(context.Background(), identity.User{}, Patch{})
	if !errors.Is(err, ErrForbidden) || r.writes != 0 {
		t.Fatal(err)
	}
}
