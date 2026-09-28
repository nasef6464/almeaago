package communicationhttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	communicationapp "github.com/nasef6464/almeaago/internal/communication/application"
	communication "github.com/nasef6464/almeaago/internal/communication/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
)

type Authenticator interface {
	Authenticate(context.Context, string) (identityapp.Authenticated, error)
	VerifyCSRF(identityapp.Authenticated, string) error
}

type Handler struct {
	service  *communicationapp.Service
	auth     Authenticator
	realtime communication.InboxRealtime
}

func New(service *communicationapp.Service, auth Authenticator) http.Handler {
	return NewWithRealtime(service, auth, nil)
}

func NewWithRealtime(
	service *communicationapp.Service,
	auth Authenticator,
	realtime communication.InboxRealtime,
) http.Handler {
	h := &Handler{service: service, auth: auth, realtime: realtime}
	r := chi.NewRouter()
	r.Get("/me", h.inbox)
	r.Get("/me/unread-count", h.unreadCount)
	r.Get("/me/preferences", h.preferences)
	r.Patch("/me/preferences", h.updatePreferences)
	r.Get("/stream", h.stream)
	r.Patch("/me/read-all", h.readAll)
	r.Patch("/{deliveryId}/read", h.readOne)
	r.Get("/admin/templates", h.adminTemplates)
	r.Post("/admin/templates", h.adminUpsertTemplate)
	r.Get("/admin/deliveries", h.adminDeliveries)
	r.Post("/admin/send", h.adminSend)
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
		return 0, communicationapp.ErrInvalidInput
	}
	return value, nil
}

func (h *Handler) inbox(w http.ResponseWriter, r *http.Request) {
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
	out, err := h.service.Inbox(r.Context(), authenticated.User, page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) unreadCount(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	count, err := h.service.UnreadCount(r.Context(), authenticated.User)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"unreadCount": count})
}

func (h *Handler) readAll(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	count, err := h.service.MarkAllRead(r.Context(), authenticated.User)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"modifiedCount": count})
}

func (h *Handler) readOne(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	item, err := h.service.MarkRead(r.Context(), authenticated.User, chi.URLParam(r, "deliveryId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"notification": item})
}

func (h *Handler) adminTemplates(w http.ResponseWriter, r *http.Request) {
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
	out, err := h.service.AdminTemplates(r.Context(), authenticated.User, page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) adminUpsertTemplate(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var input communication.TemplateWrite
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32<<10)).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
		return
	}
	item, err := h.service.UpsertTemplate(r.Context(), authenticated.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"template": item})
}

func (h *Handler) adminDeliveries(w http.ResponseWriter, r *http.Request) {
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
	out, err := h.service.AdminDeliveries(r.Context(), authenticated.User, communication.DeliveryFilter{
		Status:  communication.DeliveryStatus(strings.TrimSpace(r.URL.Query().Get("status"))),
		Channel: communication.Channel(strings.TrimSpace(r.URL.Query().Get("channel"))),
		Page:    page,
		Limit:   limit,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) adminSend(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var input communication.CampaignWrite
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
		return
	}
	out, err := h.service.SendCampaign(r.Context(), authenticated.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{
		"campaign":      out,
		"maxRecipients": communicationapp.MaxCampaignRecipients,
	})
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, communicationapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid notification request"})
	case errors.Is(err, communicationapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, communicationapp.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Notification resource not found"})
	case errors.Is(err, communicationapp.ErrConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "Notification state conflict"})
	case errors.Is(err, communicationapp.ErrAudienceTooLarge):
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]any{
			"message":       "Notification audience exceeds the bounded campaign limit",
			"maxRecipients": communicationapp.MaxCampaignRecipients,
		})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
