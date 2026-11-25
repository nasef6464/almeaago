package contenthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

func (h *Handler) listQAQuestions(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	limit, ok := parsePositiveInt(w, r.URL.Query().Get("limit"))
	if !ok {
		return
	}
	out, err := h.service.ListQAQuestions(
		r.Context(),
		auth.User,
		r.URL.Query().Get("courseId"),
		r.URL.Query().Get("filter"),
		r.URL.Query().Get("q"),
		limit,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) createQAQuestion(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input struct {
		CourseID    string `json:"courseId"`
		PathID      string `json:"pathId"`
		SubjectID   string `json:"subjectId"`
		SubjectName string `json:"subjectName"`
		Question    string `json:"question"`
		RequestID   string `json:"requestId"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := h.service.CreateQAQuestion(
		r.Context(),
		auth.User,
		input.CourseID,
		input.PathID,
		input.SubjectID,
		input.SubjectName,
		input.Question,
		input.RequestID,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"item": item})
}

func (h *Handler) listQAReplies(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	items, err := h.service.ListQAReplies(r.Context(), auth.User, chi.URLParam(r, "questionId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createQAReply(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input struct {
		Body      string `json:"body"`
		RequestID string `json:"requestId"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := h.service.CreateQAReply(r.Context(), auth.User, chi.URLParam(r, "questionId"), input.Body, input.RequestID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"item": item})
}

func (h *Handler) resolveQAQuestion(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	if err := h.service.ResolveQAQuestion(r.Context(), auth.User, chi.URLParam(r, "questionId")); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"resolved": true})
}

func (h *Handler) listLearnerLiveSessions(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	out, err := h.service.ListLearnerLiveSessions(r.Context(), auth.User)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) getLearnerLiveLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	item, err := h.service.GetLearnerLiveLesson(r.Context(), auth.User, chi.URLParam(r, "lessonId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lesson": item})
}
