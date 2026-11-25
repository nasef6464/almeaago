package operationshttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
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
	VerifyCSRF(identityapp.Authenticated, string) error
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
	r.Get("/integrations", h.getIntegrations)
	r.Patch("/integrations", h.updateIntegrations)
	r.Get("/backups", h.listBackups)
	r.Post("/backups/export", h.exportBackup)
	r.Post("/backups/validate", h.validateBackup)
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
	authenticated, ok := h.authn(w, r, false)
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

func (h *Handler) getIntegrations(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	authenticated, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	out, err := h.service.GetIntegrations(r.Context(), authenticated.User)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) updateIntegrations(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var patch operations.PlatformIntegrationPatch
	if !decodeJSON(w, r, 64<<10, &patch) {
		return
	}
	out, err := h.service.UpdateIntegrations(r.Context(), authenticated.User, patch)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) listBackups(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	authenticated, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	items, err := h.service.ListBackups(r.Context(), authenticated.User)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"total": len(items),
	})
}

func (h *Handler) exportBackup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	out, err := h.service.ExportBackup(r.Context(), authenticated.User)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) validateBackup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var input operations.BackupValidateInput
	if !decodeJSON(w, r, 10<<20, &input) {
		return
	}
	out, err := h.service.ValidateBackup(r.Context(), authenticated.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func decodeJSON(w http.ResponseWriter, r *http.Request, maxBytes int64, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid operations request"})
		return false
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); err != io.EOF {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid operations request"})
		return false
	}
	return true
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, operationsapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid operations request"})
	case errors.Is(err, operationsapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, operationsapp.ErrConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "Operations state conflict"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
