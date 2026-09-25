package organizationshttp

import (
	"net/http"

	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"

	"github.com/go-chi/chi/v5"
)

// NewParentFacade exposes only parent-authority routes. It intentionally does
// not mount the school administration surface under /api/v1/parents.
func NewParentFacade(service *orgapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/authority", h.parentAuthority)
	return r
}
