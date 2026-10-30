package navigation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	"io"
	"net/http"
)

type Authenticator interface {
	Authenticate(context.Context, string) (identityapp.Authenticated, error)
	VerifyCSRF(identityapp.Authenticated, string) error
}

// NewHandler serves the exact mounted /api/v1/learning/navigation-preferences route.
func NewHandler(service *Service, auth Authenticator) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fail := func(status int, message string) {
			w.WriteHeader(status)
			_ = json.NewEncoder(w).Encode(map[string]string{"message": message})
		}
		if r.Method != http.MethodGet && r.Method != http.MethodPatch {
			w.Header().Set("Allow", "GET, PATCH")
			fail(405, "Method not allowed")
			return
		}
		if auth == nil {
			fail(503, "Authentication unavailable")
			return
		}
		actor, err := auth.Authenticate(r.Context(), identitysession.Token(r))
		if err != nil {
			fail(401, "Authentication required")
			return
		}
		var out Preferences
		if r.Method == http.MethodPatch {
			if auth.VerifyCSRF(actor, r.Header.Get("X-CSRF-Token")) != nil {
				fail(403, "Invalid CSRF token")
				return
			}
			// Null, false, unknown keys and wrong collection shapes are not omitted fields.
			var raw map[string]json.RawMessage
			dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
			if dec.Decode(&raw) != nil || raw == nil {
				fail(400, "Invalid request body")
				return
			}
			var extra any
			if dec.Decode(&extra) != io.EOF {
				fail(400, "Invalid request body")
				return
			}
			for k, v := range raw {
				if (k != "enrolledPaths" && k != "pathStageSelections") || string(v) == "null" {
					fail(400, "Invalid request body")
					return
				}
			}
			body, _ := json.Marshal(raw)
			var p Patch
			strict := json.NewDecoder(bytes.NewReader(body))
			strict.DisallowUnknownFields()
			if strict.Decode(&p) != nil {
				fail(400, "Invalid request body")
				return
			}
			out, err = service.Patch(r.Context(), actor.User, p)
		} else {
			out, err = service.Get(r.Context(), actor.User)
		}
		if err != nil {
			if errors.Is(err, ErrInvalid) {
				fail(400, "Invalid navigation preferences")
			} else if errors.Is(err, ErrForbidden) {
				fail(401, "Authentication required")
			} else {
				fail(500, "Unable to save navigation preferences")
			}
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"user": map[string]any{"id": actor.User.ID, "enrolledPaths": out.EnrolledPaths, "pathStageSelections": out.PathStageSelections}})
	})
}
