package organizationshttp

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type schoolContractHandler struct {
	service *orgapp.SchoolContractService
	auth    Authenticator
}

func NewSchoolContractHandler(service *orgapp.SchoolContractService, auth Authenticator) http.Handler {
	h := &schoolContractHandler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/{schoolId}", h.get)
	r.Put("/{schoolId}", h.upsert)
	return r
}

func (h *schoolContractHandler) authenticate(
	w http.ResponseWriter,
	r *http.Request,
	requireCSRF bool,
) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	auth, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeIdentityError(w, err)
		return identityapp.Authenticated{}, false
	}
	if requireCSRF && h.auth.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")) != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
		return identityapp.Authenticated{}, false
	}
	return auth, true
}

func presentSchoolContract(contract org.SchoolContract) map[string]any {
	modules := make([]string, 0, len(contract.Modules))
	for _, module := range contract.Modules {
		modules = append(modules, string(module))
	}
	return map[string]any{
		"id":         contract.ID,
		"schoolId":   contract.SchoolID,
		"status":     contract.Status,
		"modules":    modules,
		"validFrom":  contract.ValidFrom,
		"validUntil": contract.ValidUntil,
		"revision":   contract.Revision,
		"createdAt":  contract.CreatedAt,
		"updatedAt":  contract.UpdatedAt,
	}
}

func (h *schoolContractHandler) get(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	contract, err := h.service.Get(r.Context(), auth.User, chi.URLParam(r, "schoolId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"contract": presentSchoolContract(contract)})
}

func (h *schoolContractHandler) upsert(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Status           org.SchoolContractStatus
		Modules          []org.SchoolModule
		ValidFrom        *time.Time
		ValidUntil       *time.Time
		ExpectedRevision int
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	contract, err := h.service.Upsert(r.Context(), auth.User, chi.URLParam(r, "schoolId"), org.SchoolContractWrite{
		Status:           payload.Status,
		Modules:          payload.Modules,
		ValidFrom:        payload.ValidFrom,
		ValidUntil:       payload.ValidUntil,
		ExpectedRevision: payload.ExpectedRevision,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"contract": presentSchoolContract(contract)})
}
