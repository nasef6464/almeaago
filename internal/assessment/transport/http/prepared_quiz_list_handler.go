package assessmenthttp

import "net/http"

func (h *Handler) listPreparedQuizzes(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	cards, err := h.service.ListPreparedQuizzes(r.Context(), a.User)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, 200, map[string]any{"quizzes": cards})
}
