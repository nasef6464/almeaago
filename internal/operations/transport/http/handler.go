package operationshttp

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
	operationsapp "github.com/nasef6464/almeaago/internal/operations/application"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type Authenticator interface {
	Authenticate(context.Context, string) (identityapp.Authenticated, error)
}

type Handler struct {
	service *operationsapp.Service
	auth    Authenticator
}

func New(service *operationsapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/audit", h.audit)
	r.Get("/readiness", h.readiness)
	return r
}

func (h *Handler) authn(w http.ResponseWriter, r *http.Request) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	authenticated, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	return authenticated, true
}

func parsePositive(raw string) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return 0, operationsapp.ErrInvalidInput
	}
	return value, nil
}

func (h *Handler) audit(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r)
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
	out, err := h.service.Audit(r.Context(), authenticated.User, operations.AuditQuery{
		Action:       strings.TrimSpace(r.URL.Query().Get("action")),
		Status:       operations.AuditStatus(strings.TrimSpace(r.URL.Query().Get("status"))),
		ResourceType: strings.TrimSpace(r.URL.Query().Get("resourceType")),
		ActorUserID:  strings.TrimSpace(r.URL.Query().Get("actorUserId")),
		Page:         page,
		Limit:        limit,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) readiness(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	out, err := h.service.Readiness(r.Context(), authenticated.User)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, operationsapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid operations request"})
	case errors.Is(err, operationsapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
