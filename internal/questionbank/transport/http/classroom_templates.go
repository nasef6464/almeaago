package questionhttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	questionapp "github.com/nasef6464/almeaago/internal/questionbank/application"
)

func (h *Handler) listClassroomTemplates(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	items, err := h.service.ListClassroomTemplates(r.Context(), auth.User, r.URL.Query().Get("schoolId"))
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, map[string]any{"templates": items})
}

func (h *Handler) createClassroomTemplate(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input questionapp.CreateClassroomTemplateInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := h.service.CreateClassroomTemplate(r.Context(), auth.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusCreated, map[string]any{"template": item})
}

func (h *Handler) deleteClassroomTemplate(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	if err := h.service.DeleteClassroomTemplate(r.Context(), auth.User, chi.URLParam(r, "id")); err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}
