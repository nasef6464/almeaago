package contenthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
)

func NewLessons(service *contentapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/", h.listLessons)
	r.Post("/", h.createLesson)
	r.Get("/{id}", h.getLesson)
	r.Put("/{id}", h.updateLesson)
	r.Patch("/{id}/workflow", h.lessonWorkflow)
	return r
}

func (h *Handler) listLessons(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	query, ok := parseListQuery(w, r)
	if !ok {
		return
	}
	page, err := h.service.ListLessons(r.Context(), auth.User, query)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]map[string]any, 0, len(page.Items))
	for _, row := range page.Items {
		items = append(items, presentLessonSummary(row))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page.Page, "limit": page.Limit, "hasMore": page.HasMore})
}

func (h *Handler) createLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.LessonInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.CreateLesson(r.Context(), auth.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"lesson": presentLesson(row)})
}

func (h *Handler) getLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.StaffLesson(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lesson": presentLesson(row)})
}

func (h *Handler) updateLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.UpdateLessonInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.UpdateLesson(r.Context(), auth.User, chi.URLParam(r, "id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lesson": presentLesson(row)})
}

func (h *Handler) lessonWorkflow(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.WorkflowInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.SetLessonWorkflow(r.Context(), auth.User, chi.URLParam(r, "id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lesson": presentLesson(row)})
}
