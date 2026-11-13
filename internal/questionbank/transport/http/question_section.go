package questionhttp

import (
	"github.com/go-chi/chi/v5"
	"net/http"
)

func (h *Handler) getQuestionSection(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	section, err := h.service.QuestionSection(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, map[string]string{"sectionId": section})
}

func (h *Handler) setQuestionSection(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input struct {
		SectionID *string `json:"sectionId"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if input.SectionID == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "sectionId is required"})
		return
	}
	if err := h.service.SetQuestionSection(r.Context(), auth.User, chi.URLParam(r, "id"), *input.SectionID); err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, map[string]string{"sectionId": *input.SectionID})
}
