package learninghttp

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type LessonProgressHandler struct {
	service *learningapp.LessonProgressService
	auth    Authenticator
}

func NewLessonProgress(service *learningapp.LessonProgressService, auth Authenticator) http.Handler {
	h := &LessonProgressHandler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/lessons/{lessonId}", h.get)
	r.Put("/lessons/{lessonId}/video", h.video)
	r.Post("/lessons/{lessonId}/complete", h.complete)
	return r
}

func lessonContextFromRequest(r *http.Request) learning.LessonProgressContextInput {
	return learning.LessonProgressContextInput{
		ContextType: learning.LessonProgressContext(r.URL.Query().Get("contextType")),
		CourseID:    r.URL.Query().Get("courseId"),
		TopicID:     r.URL.Query().Get("topicId"),
	}
}

func (h *LessonProgressHandler) get(w http.ResponseWriter, r *http.Request) {
	a, ok := (&Handler{auth: h.auth}).authn(w, r, false)
	if !ok {
		return
	}
	out, err := h.service.Get(r.Context(), a.User, chi.URLParam(r, "lessonId"), lessonContextFromRequest(r))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"progress": out})
}

func (h *LessonProgressHandler) video(w http.ResponseWriter, r *http.Request) {
	a, ok := (&Handler{auth: h.auth}).authn(w, r, true)
	if !ok {
		return
	}
	var in learning.VideoProgressWrite
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
		return
	}
	out, err := h.service.SaveVideo(r.Context(), a.User, chi.URLParam(r, "lessonId"), in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"progress": out})
}

func (h *LessonProgressHandler) complete(w http.ResponseWriter, r *http.Request) {
	a, ok := (&Handler{auth: h.auth}).authn(w, r, true)
	if !ok {
		return
	}
	var in learning.LessonProgressContextInput
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
		return
	}
	out, err := h.service.Complete(r.Context(), a.User, chi.URLParam(r, "lessonId"), in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"progress": out})
}
