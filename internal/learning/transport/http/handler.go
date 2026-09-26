package learninghttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type Authenticator interface {
	Authenticate(context.Context, string) (identityapp.Authenticated, error)
	VerifyCSRF(identityapp.Authenticated, string) error
}

type Handler struct {
	service *learningapp.Service
	auth    Authenticator
}

func NewReview(service *learningapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/library", h.library)
	r.Put("/questions/{questionId}/saved", h.save)
	r.Delete("/questions/{questionId}/saved", h.unsave)
	return r
}

func NewMastery(service *learningapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/progress", h.progress)
	r.Get("/next-action", h.nextAction)
	return r
}

func (h *Handler) authn(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
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

func parsePositive(raw string) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return 0, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return 0, learningapp.ErrInvalidInput
	}
	return value, nil
}

func (h *Handler) library(w http.ResponseWriter, r *http.Request) {
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
	out, err := h.service.ReviewLibrary(
		r.Context(), authenticated.User, learning.ReviewTab(r.URL.Query().Get("tab")),
		r.URL.Query().Get("pathId"), r.URL.Query().Get("subjectId"), page, limit,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) save(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	if err := h.service.SetSaved(r.Context(), authenticated.User, chi.URLParam(r, "questionId"), true); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) unsave(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	if err := h.service.SetSaved(r.Context(), authenticated.User, chi.URLParam(r, "questionId"), false); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) progress(w http.ResponseWriter, r *http.Request) {
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
	out, err := h.service.Progress(
		r.Context(), authenticated.User, r.URL.Query().Get("pathId"),
		r.URL.Query().Get("subjectId"), page, limit,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) nextAction(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	out, err := h.service.NextAction(
		r.Context(), authenticated.User, r.URL.Query().Get("pathId"), r.URL.Query().Get("subjectId"),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"item": out})
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, learningapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid learning request"})
	case errors.Is(err, learningapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, learningapp.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Review item not found"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
