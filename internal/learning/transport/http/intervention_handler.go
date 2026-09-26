package learninghttp

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type InterventionHandler struct {
	service *learningapp.InterventionService
	auth    Authenticator
}

func NewInterventions(service *learningapp.InterventionService, auth Authenticator) http.Handler {
	h := &InterventionHandler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/staff", h.listStaff)
	r.Post("/staff", h.create)
	r.Patch("/staff/{id}", h.patch)
	r.Post("/staff/{id}/measure", h.measure)
	r.Get("/mine", h.mine)
	return r
}

func (h *InterventionHandler) authn(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	a, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	if csrf && h.auth.VerifyCSRF(a, r.Header.Get("X-CSRF-Token")) != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
		return identityapp.Authenticated{}, false
	}
	return a, true
}

func decodeIntervention(w http.ResponseWriter, r *http.Request, out any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(out); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
		return false
	}
	return true
}

func (h *InterventionHandler) listStaff(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	page, err := parsePositive(r.URL.Query().Get("page"))
	if err != nil {
		writeError(w, err)
		return
	}
	limit, err := parsePositive(r.URL.Query().Get("limit"))
	if err != nil {
		writeError(w, err)
		return
	}
	out, err := h.service.List(
		r.Context(), a.User,
		r.URL.Query().Get("schoolId"),
		r.URL.Query().Get("classId"),
		learning.InterventionStatus(r.URL.Query().Get("status")),
		page, limit,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *InterventionHandler) create(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in learning.InterventionCreate
	if !decodeIntervention(w, r, &in) {
		return
	}
	out, err := h.service.Create(r.Context(), a.User, in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"intervention": out})
}

func (h *InterventionHandler) patch(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in learning.InterventionPatch
	if !decodeIntervention(w, r, &in) {
		return
	}
	out, err := h.service.Patch(r.Context(), a.User, chi.URLParam(r, "id"), in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"intervention": out})
}

func (h *InterventionHandler) measure(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in struct {
		ExpectedUpdatedAt time.Time `json:"expectedUpdatedAt"`
	}
	if !decodeIntervention(w, r, &in) {
		return
	}
	out, err := h.service.Measure(r.Context(), a.User, chi.URLParam(r, "id"), in.ExpectedUpdatedAt)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"outcome": out})
}

func (h *InterventionHandler) mine(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	page, err := parsePositive(r.URL.Query().Get("page"))
	if err != nil {
		writeError(w, err)
		return
	}
	limit, err := parsePositive(r.URL.Query().Get("limit"))
	if err != nil {
		writeError(w, err)
		return
	}
	out, err := h.service.Mine(
		r.Context(), a.User,
		learning.InterventionStatus(r.URL.Query().Get("status")),
		page, limit,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}
