package commercehttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	commerceapp "github.com/nasef6464/almeaago/internal/commerce/application"
)

func NewLegacyContracts(
	service *commerceapp.SchoolContractService,
	auth Authenticator,
) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/{schoolId}", h.getContract)
	r.Put("/{schoolId}", h.upsertContract)
	return r
}

func NewLegacyEntitlements(
	service *commerceapp.SchoolContractService,
	auth Authenticator,
	contexts SchoolContextResolver,
) http.Handler {
	h := &Handler{service: service, auth: auth, contexts: contexts}
	r := chi.NewRouter()
	r.Get("/{schoolId}/{module}", h.resolveModule)
	return r
}