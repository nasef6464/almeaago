package assessmenthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	app "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func (h *Handler) stagePreparedQuiz(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var in assessment.PreparedQuizStage
	if !decode(w, r, &in) {
		return
	}
	if err := h.service.StagePreparedQuiz(r.Context(), a.User, chi.URLParam(r, "id"), in); err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, map[string]any{"staged": true, "active": false})
}

func (h *Handler) getPreparedQuizStage(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	stage, err := h.service.GetPreparedQuizStage(r.Context(), a.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, map[string]any{"stage": stage, "active": stage.Enabled, "wasEnabled": stage.WasEnabled, "targetUsers": stage.TargetUsers})
}

func (h *Handler) setPreparedQuizStatus(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input struct {
		Enabled *bool `json:"enabled"`
	}
	if !decode(w, r, &input) {
		return
	}
	if input.Enabled == nil {
		writeError(w, app.ErrInvalidInput)
		return
	}
	active, was, err := h.service.SetPreparedQuizEnabled(r.Context(), a.User, chi.URLParam(r, "id"), *input.Enabled)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, map[string]any{"enabled": active, "wasEnabled": was})
}
