package contenthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
)

func NewCourses(service *contentapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/", h.listCourses)
	r.Post("/", h.createCourse)
	r.Get("/{id}", h.getCourse)
	r.Put("/{id}", h.updateCourse)
	r.Patch("/{id}/workflow", h.courseWorkflow)
	r.Patch("/{id}/publication", h.coursePublication)
	r.Get("/{id}/modules", h.listCourseModules)
	r.Post("/{id}/modules", h.createCourseModule)
	r.Put("/{id}/modules/{moduleId}", h.updateCourseModule)
	r.Put("/{id}/modules/{moduleId}/lessons/{lessonId}", h.placeCourseLesson)
	r.Delete("/{id}/modules/{moduleId}/lessons/{lessonId}", h.removeCourseLesson)
	return r
}

func (h *Handler) listCourses(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	query, ok := parseListQuery(w, r)
	if !ok {
		return
	}
	page, err := h.service.ListCourses(r.Context(), auth.User, query)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]map[string]any, 0, len(page.Items))
	for _, row := range page.Items {
		items = append(items, presentCourseSummary(row))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page.Page, "limit": page.Limit, "hasMore": page.HasMore})
}

func (h *Handler) createCourse(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.CourseInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.CreateCourse(r.Context(), auth.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"course": presentCourse(row)})
}

func (h *Handler) getCourse(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.StaffCourse(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": presentCourse(row)})
}

func (h *Handler) updateCourse(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.UpdateCourseInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.UpdateCourse(r.Context(), auth.User, chi.URLParam(r, "id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": presentCourse(row)})
}

func (h *Handler) courseWorkflow(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.WorkflowInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.SetCourseWorkflow(r.Context(), auth.User, chi.URLParam(r, "id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": presentCourse(row)})
}

func (h *Handler) coursePublication(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.PublicationInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.SetCoursePublication(r.Context(), auth.User, chi.URLParam(r, "id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": presentCourse(row)})
}
