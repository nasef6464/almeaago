package contenthttp

import (
	"github.com/go-chi/chi/v5"
	"net/http"
)

func (h *Handler) getLessonDiscussion(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	page, ok := parsePositiveInt(w, r.URL.Query().Get("page"))
	if !ok {
		return
	}
	limit, ok := parsePositiveInt(w, r.URL.Query().Get("limit"))
	if !ok {
		return
	}
	out, err := h.service.LessonDiscussion(r.Context(), auth.User, chi.URLParam(r, "courseId"), chi.URLParam(r, "lessonId"), page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) addLessonDiscussion(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input struct {
		Body      string `json:"body"`
		ParentID  string `json:"parentId"`
		RequestID string `json:"requestId"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := h.service.AddLessonDiscussion(r.Context(), auth.User, chi.URLParam(r, "courseId"), chi.URLParam(r, "lessonId"), input.ParentID, input.Body, input.RequestID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"item": item})
}
