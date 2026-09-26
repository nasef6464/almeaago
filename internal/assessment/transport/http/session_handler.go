package assessmenthttp

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"

	app "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
)

type SessionHandler struct {
	service *app.SessionService
	auth    Authenticator
}

func NewSessions(service *app.SessionService, auth Authenticator) http.Handler {
	h := &SessionHandler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/join/{code}", h.live)
	r.Patch("/{id}/status", h.status)
	r.Post("/{id}/start", h.startLive)
	return r
}

func (h *SessionHandler) authenticateSession(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
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

func (h *SessionHandler) list(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticateSession(w, r, false)
	if !ok {
		return
	}
	page, err := atoi(r.URL.Query().Get("page"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid pagination"})
		return
	}
	limit, err := atoi(r.URL.Query().Get("limit"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid pagination"})
		return
	}
	out, err := h.service.List(r.Context(), a.User, r.URL.Query().Get("assessmentId"), page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *SessionHandler) create(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticateSession(w, r, true)
	if !ok {
		return
	}
	var in assessment.SessionWrite
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.Create(r.Context(), a.User, in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"session": out})
}

func (h *SessionHandler) status(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticateSession(w, r, true)
	if !ok {
		return
	}
	var in struct {
		Status assessment.SessionStatus `json:"status"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.Status(r.Context(), a.User, chi.URLParam(r, "id"), in.Status)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"session": out})
}

func (h *SessionHandler) live(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticateSession(w, r, false)
	if !ok {
		return
	}
	out, err := h.service.Live(r.Context(), a.User, chi.URLParam(r, "code"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"session": out})
}

func (h *SessionHandler) startLive(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticateSession(w, r, true)
	if !ok {
		return
	}
	var in struct {
		StartKey string `json:"startKey"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.StartLive(r.Context(), a.User, chi.URLParam(r, "id"), in.StartKey)
	if err != nil {
		writeAttemptError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"attempt": out})
}

type PublicSessionHandler struct {
	service *app.SessionService
}

func NewPublicSessions(service *app.SessionService) http.Handler {
	h := &PublicSessionHandler{service: service}
	r := chi.NewRouter()
	r.Post("/{code}/start", h.start)
	r.Post("/{code}/submit", h.submit)
	return r
}

func (h *PublicSessionHandler) start(w http.ResponseWriter, r *http.Request) {
	var in assessment.PublicStartInput
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.StartPublic(r.Context(), chi.URLParam(r, "code"), in)
	if err != nil {
		writeAttemptError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"attempt": out})
}

func (h *PublicSessionHandler) submit(w http.ResponseWriter, r *http.Request) {
	var in assessment.PublicSubmitInput
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.SubmitPublic(r.Context(), chi.URLParam(r, "code"), in)
	if err != nil {
		writeAttemptError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

var _ context.Context
