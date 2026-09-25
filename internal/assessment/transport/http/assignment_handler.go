package assessmenthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	app "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
)

type AssignmentHandler struct {
	service *app.AssignmentService
	auth    Authenticator
}

func NewAssignments(s *app.AssignmentService, a Authenticator) http.Handler {
	h := &AssignmentHandler{service: s, auth: a}
	r := chi.NewRouter()
	r.Get("/mine", h.mine)
	r.Post("/{id}/start", h.start)
	r.Post("/{id}/status", h.status)
	return r
}
func (h *AssignmentHandler) authn(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, 503, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	a, e := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if e != nil {
		writeJSON(w, 401, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	if csrf && h.auth.VerifyCSRF(a, r.Header.Get("X-CSRF-Token")) != nil {
		writeJSON(w, 403, map[string]string{"message": "Invalid CSRF token"})
		return identityapp.Authenticated{}, false
	}
	return a, true
}
func (h *AssignmentHandler) mine(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	page, e := atoi(r.URL.Query().Get("page"))
	if e != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	limit, e := atoi(r.URL.Query().Get("limit"))
	if e != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	items, more, e := h.service.Learner(r.Context(), a.User, page, limit)
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"items": items, "page": page, "limit": limit, "hasMore": more})
}
func (h *AssignmentHandler) start(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in struct {
		StartKey string `json:"startKey"`
	}
	if !decode(w, r, &in) {
		return
	}
	x, e := h.service.Start(r.Context(), a.User, chi.URLParam(r, "id"), in.StartKey)
	if e != nil {
		writeAttemptError(w, e)
		return
	}
	writeJSON(w, 201, map[string]any{"attempt": x})
}
func (h *AssignmentHandler) status(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in struct {
		Status assessment.AssignmentStatus `json:"status"`
	}
	if !decode(w, r, &in) {
		return
	}
	x, e := h.service.Status(r.Context(), a.User, chi.URLParam(r, "id"), in.Status)
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"assignment": x})
}
