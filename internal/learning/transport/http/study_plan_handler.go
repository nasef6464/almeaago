package learninghttp

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type StudyPlanHandler struct {
	service *learningapp.StudyPlanService
	auth    Authenticator
}

func NewStudyPlans(service *learningapp.StudyPlanService, auth Authenticator) http.Handler {
	h := &StudyPlanHandler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/{id}", h.get)
	r.Patch("/{id}", h.update)
	r.Delete("/{id}", h.delete)
	return r
}

func (h *StudyPlanHandler) authn(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	authenticated, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	if csrf && h.auth.VerifyCSRF(authenticated, r.Header.Get("X-CSRF-Token")) != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
		return identityapp.Authenticated{}, false
	}
	return authenticated, true
}

func decodeStudyPlan(w http.ResponseWriter, r *http.Request, out any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(out); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
		return false
	}
	return true
}

func (h *StudyPlanHandler) list(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, false)
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
		r.Context(),
		authenticated.User,
		r.URL.Query().Get("pathId"),
		learning.StudyPlanStatus(r.URL.Query().Get("status")),
		page,
		limit,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *StudyPlanHandler) get(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	out, err := h.service.Get(r.Context(), authenticated.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"plan": out})
}

func (h *StudyPlanHandler) create(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in learning.StudyPlanWrite
	if !decodeStudyPlan(w, r, &in) {
		return
	}
	out, err := h.service.Create(r.Context(), authenticated.User, in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"plan": out})
}

func (h *StudyPlanHandler) update(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in learning.StudyPlanPatch
	if !decodeStudyPlan(w, r, &in) {
		return
	}
	out, err := h.service.Update(r.Context(), authenticated.User, chi.URLParam(r, "id"), in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"plan": out})
}

func (h *StudyPlanHandler) delete(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	if err := h.service.Delete(r.Context(), authenticated.User, chi.URLParam(r, "id")); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}
