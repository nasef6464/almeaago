package commercehttp

import (
	"context"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	commerceapp "github.com/nasef6464/almeaago/internal/commerce/application"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type Authenticator interface {
	Authenticate(ctx context.Context, rawToken string) (identityapp.Authenticated, error)
	VerifyCSRF(auth identityapp.Authenticated, rawToken string) error
}

type SchoolContextResolver interface {
	SchoolContexts(ctx context.Context, actor identitydomain.User) ([]orgdomain.SchoolContext, error)
}

type Handler struct {
	service  *commerceapp.SchoolContractService
	auth     Authenticator
	contexts SchoolContextResolver
}

func New(
	service *commerceapp.SchoolContractService,
	auth Authenticator,
	contexts SchoolContextResolver,
) http.Handler {
	h := &Handler{service: service, auth: auth, contexts: contexts}
	r := chi.NewRouter()

	r.Get("/schools/{schoolId}/contract", h.getContract)
	r.Put("/schools/{schoolId}/contract", h.upsertContract)
	r.Get("/schools/{schoolId}/modules/{module}", h.resolveModule)

	return r
}

func (h *Handler) getContract(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	contract, err := h.service.Contract(r.Context(), auth.User, chi.URLParam(r, "schoolId"))
	if err != nil {
		writeError(w, err)
		return
	}
	if contract == nil {
		writeJSON(w, http.StatusOK, map[string]any{"contract": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"contract": presentContract(*contract)})
}

func (h *Handler) upsertContract(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Status     commerce.SchoolContractStatus `json:"status"`
		Modules    []commerce.SchoolModule       `json:"modules"`
		ValidFrom  *string                       `json:"validFrom"`
		ValidUntil *string                       `json:"validUntil"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	validFrom, err := parseOptionalTime(payload.ValidFrom)
	if err != nil {
		writeError(w, commerceapp.ErrInvalidInput)
		return
	}
	validUntil, err := parseOptionalTime(payload.ValidUntil)
	if err != nil {
		writeError(w, commerceapp.ErrInvalidInput)
		return
	}

	contract, err := h.service.Upsert(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		commerceapp.UpsertSchoolContractInput{
			Status:     payload.Status,
			Modules:    payload.Modules,
			ValidFrom:  validFrom,
			ValidUntil: validUntil,
		},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"contract": presentContract(contract)})
}

func (h *Handler) resolveModule(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}

	schoolID := strings.TrimSpace(chi.URLParam(r, "schoolId"))
	module := commerce.SchoolModule(strings.TrimSpace(chi.URLParam(r, "module")))
	if schoolID == "" || !commerce.ValidSchoolModule(module) {
		writeError(w, commerceapp.ErrInvalidInput)
		return
	}

	if !auth.User.HasRole(identitydomain.RoleAdmin) {
		if h.contexts == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "School scope service unavailable"})
			return
		}
		contexts, err := h.contexts.SchoolContexts(r.Context(), auth.User)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
			return
		}
		allowed := false
		for _, schoolContext := range contexts {
			if schoolContext.SchoolID == schoolID {
				allowed = true
				break
			}
		}
		if !allowed {
			writeJSON(w, http.StatusForbidden, map[string]string{"message": "School access denied"})
			return
		}
	}

	result, err := h.service.ResolveModule(r.Context(), schoolID, module)
	if err != nil {
		writeError(w, err)
		return
	}

	var contract any
	if result.Contract != nil {
		contract = presentContract(*result.Contract)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"allowed":  result.Allowed,
		"contract": contract,
	})
}