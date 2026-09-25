package contenthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
)

func NewFoundation(service *contentapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/topics", h.listTopics)
	r.Post("/topics", h.createTopic)
	r.Get("/topics/{id}", h.getTopic)
	r.Put("/topics/{id}", h.updateTopic)
	return r
}

func (h *Handler) listTopics(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	query, ok := parseTopicQuery(w, r)
	if !ok {
		return
	}
	page, err := h.service.ListTopics(r.Context(), auth.User, query)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]map[string]any, 0, len(page.Items))
	for _, row := range page.Items {
		items = append(items, presentTopicSummary(row))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page.Page, "limit": page.Limit, "hasMore": page.HasMore})
}

func (h *Handler) createTopic(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.TopicInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.CreateTopic(r.Context(), auth.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"topic": presentTopic(row)})
}

func (h *Handler) getTopic(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.StaffTopic(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"topic": presentTopic(row)})
}

func (h *Handler) updateTopic(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.UpdateTopicInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.UpdateTopic(r.Context(), auth.User, chi.URLParam(r, "id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"topic": presentTopic(row)})
}
