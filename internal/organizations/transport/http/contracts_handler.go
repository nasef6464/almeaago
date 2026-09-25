package organizationshttp

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (h *Handler) schoolContract(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	contract, err := h.service.SchoolContract(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"contract": presentSchoolContract(contract),
	})
}

func (h *Handler) upsertSchoolContract(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	input, ok := decodeContractInput(w, r)
	if !ok {
		return
	}
	contract, err := h.service.UpsertSchoolContract(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		input,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"contract": presentSchoolContract(&contract),
	})
}

func (h *Handler) schoolEntitlement(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	entitlement, err := h.service.ResolveSchoolEntitlement(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		orgdomain.SchoolModule(chi.URLParam(r, "module")),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"allowed":  entitlement.Allowed,
		"contract": presentSchoolContract(entitlement.Contract),
	})
}

func (h *LegacyHandler) legacySchoolContract(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	contract, err := h.service.SchoolContract(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"contract": presentSchoolContract(contract),
	})
}

func (h *LegacyHandler) legacyUpsertSchoolContract(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	input, ok := decodeContractInput(w, r)
	if !ok {
		return
	}
	contract, err := h.service.UpsertSchoolContract(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		input,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"contract": presentSchoolContract(&contract),
	})
}

func (h *LegacyHandler) legacySchoolEntitlement(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	entitlement, err := h.service.ResolveSchoolEntitlement(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		orgdomain.SchoolModule(chi.URLParam(r, "module")),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"allowed":  entitlement.Allowed,
		"contract": presentSchoolContract(entitlement.Contract),
	})
}

func decodeContractInput(
	w http.ResponseWriter,
	r *http.Request,
) (orgapp.UpsertSchoolContractInput, bool) {
	var payload struct {
		Status     orgdomain.SchoolContractStatus `json:"status"`
		Modules    []orgdomain.SchoolModule        `json:"modules"`
		ValidFrom  *time.Time                      `json:"validFrom"`
		ValidUntil *time.Time                      `json:"validUntil"`
	}
	if !decodeJSON(w, r, &payload) {
		return orgapp.UpsertSchoolContractInput{}, false
	}
	return orgapp.UpsertSchoolContractInput{
		Status:     payload.Status,
		Modules:    payload.Modules,
		ValidFrom:  payload.ValidFrom,
		ValidUntil: payload.ValidUntil,
	}, true
}

func presentSchoolContract(contract *orgdomain.SchoolContract) any {
	if contract == nil {
		return nil
	}
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
		"createdAt":  contract.CreatedAt,
		"updatedAt":  contract.UpdatedAt,
	}
}
