package aihttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	aiapp "github.com/nasef6464/almeaago/internal/ai/application"
	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
)

type Authenticator interface {
	Authenticate(context.Context, string) (identityapp.Authenticated, error)
	VerifyCSRF(identityapp.Authenticated, string) error
}

type Handler struct {
	service *aiapp.Service
	auth    Authenticator
}

func New(service *aiapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/admin/providers", h.adminProviders)
	r.Patch("/admin/providers/{provider}", h.adminUpdateProvider)
	r.Post("/admin/providers/{provider}/test", h.adminTestProvider)
	r.Get("/admin/interactions", h.adminInteractions)
	r.Post("/question-assistant", h.questionAssistant)
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
		return 0, aiapp.ErrInvalidInput
	}
	return value, nil
}

func presentProvider(item ai.ProviderSetting) map[string]any {
	health := map[string]any{
		"consecutiveFailures": item.Health.ConsecutiveFailures,
		"openUntil":           item.Health.OpenUntil,
		"lastError":           item.Health.LastError,
		"lastSuccessAt":       item.Health.LastSuccessAt,
		"lastFailureAt":       item.Health.LastFailureAt,
		"updatedAt":           item.Health.UpdatedAt,
	}
	return map[string]any{
		"provider":         item.Provider,
		"enabled":          item.Enabled,
		"model":            item.Model,
		"baseUrl":          item.BaseURL,
		"priority":         item.Priority,
		"maxOutputTokens":  item.MaxOutputTokens,
		"revision":         item.Revision,
		"secretConfigured": item.SecretConfigured,
		"health":           health,
		"createdAt":        item.CreatedAt,
		"updatedAt":        item.UpdatedAt,
	}
}

func presentInteraction(item ai.Interaction) map[string]any {
	return map[string]any{
		"id":              item.ID,
		"userId":          item.UserID,
		"audience":        item.Audience,
		"endpoint":        item.Endpoint,
		"capability":      item.Capability,
		"provider":        item.Provider,
		"model":           item.Model,
		"status":          item.Status,
		"usedFallback":    item.UsedFallback,
		"cacheHit":        item.CacheHit,
		"questionId":      item.QuestionID,
		"questionVersion": item.QuestionVersion,
		"reviewCardId":    item.ReviewCardID,
		"promptVersion":   item.PromptVersion,
		"latencyMs":       item.LatencyMS,
		"inputTokens":     item.InputTokens,
		"outputTokens":    item.OutputTokens,
		"totalTokens":     item.TotalTokens,
		"usageEstimated":  item.UsageEstimated,
		"responseLength":  item.ResponseLength,
		"errorCategory":   item.ErrorCategory,
		"metadata":        item.Metadata,
		"retentionUntil":  item.RetentionUntil,
		"createdAt":       item.CreatedAt,
	}
}

func (h *Handler) adminProviders(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	rows, err := h.service.AdminProviders(r.Context(), authenticated.User)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		items = append(items, presentProvider(row))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) adminUpdateProvider(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Enabled          bool   `json:"enabled"`
		Model            string `json:"model"`
		BaseURL          string `json:"baseUrl"`
		Priority         int    `json:"priority"`
		MaxOutputTokens  int    `json:"maxOutputTokens"`
		ExpectedRevision int    `json:"expectedRevision"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
		return
	}
	item, err := h.service.UpdateProvider(r.Context(), authenticated.User, ai.Provider(chi.URLParam(r, "provider")), ai.ProviderSettingWrite{
		Enabled: payload.Enabled, Model: payload.Model, BaseURL: payload.BaseURL,
		Priority: payload.Priority, MaxOutputTokens: payload.MaxOutputTokens,
		ExpectedRevision: payload.ExpectedRevision,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"provider": presentProvider(item)})
}

func (h *Handler) adminTestProvider(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	out, err := h.service.TestProvider(r.Context(), authenticated.User, ai.Provider(chi.URLParam(r, "provider")))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"result": map[string]any{
			"text":     out.Text,
			"provider": out.Provider,
			"model":    out.Model,
			"usage": map[string]any{
				"inputTokens": out.Usage.InputTokens,
				"outputTokens": out.Usage.OutputTokens,
				"totalTokens": out.Usage.TotalTokens,
				"cachedTokens": out.Usage.CachedTokens,
				"estimated": out.Usage.Estimated,
			},
		},
	})
}

func (h *Handler) adminInteractions(w http.ResponseWriter, r *http.Request) {
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
	out, err := h.service.AdminInteractions(r.Context(), authenticated.User, page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]map[string]any, 0, len(out.Items))
	for _, row := range out.Items {
		items = append(items, presentInteraction(row))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items": items, "page": out.Page, "limit": out.Limit, "hasMore": out.HasMore,
	})
}

func (h *Handler) questionAssistant(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		ReviewCardID string       `json:"reviewCardId"`
		HelpLevel    ai.HelpLevel `json:"helpLevel"`
		Message      string       `json:"message"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
		return
	}
	out, err := h.service.QuestionAssist(r.Context(), authenticated.User, ai.QuestionAssistInput{
		ReviewCardID: payload.ReviewCardID,
		HelpLevel: payload.HelpLevel,
		Message: payload.Message,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"result": map[string]any{
			"text": out.Text, "helpLevel": out.HelpLevel, "provider": out.Provider, "model": out.Model,
			"usedFallback": out.UsedFallback, "cacheHit": out.CacheHit, "promptVersion": out.PromptVersion,
		},
	})
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, aiapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid AI request"})
	case errors.Is(err, aiapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, aiapp.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "AI context not found"})
	case errors.Is(err, aiapp.ErrConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "AI state conflict"})
	case errors.Is(err, aiapp.ErrUnavailable):
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "AI provider unavailable"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
