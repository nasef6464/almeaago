package contenthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
)

func (h *Handler) listCourseModules(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	modules, err := h.service.CourseModules(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]map[string]any, 0, len(modules))
	for _, module := range modules {
		items = append(items, presentCourseModule(module))
	}
	writeJSON(w, http.StatusOK, map[string]any{"modules": items})
}

func (h *Handler) createCourseModule(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.CourseModuleInput
	if !decodeJSON(w, r, &input) {
		return
	}
	module, revision, err := h.service.CreateCourseModule(r.Context(), auth.User, chi.URLParam(r, "id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"module": presentCourseModule(module), "courseRevision": revision})
}

func (h *Handler) updateCourseModule(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.CourseModuleInput
	if !decodeJSON(w, r, &input) {
		return
	}
	module, revision, err := h.service.UpdateCourseModule(
		r.Context(),
		auth.User,
		chi.URLParam(r, "id"),
		chi.URLParam(r, "moduleId"),
		input,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"module": presentCourseModule(module), "courseRevision": revision})
}

func (h *Handler) placeCourseLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.PlacementInput
	if !decodeJSON(w, r, &input) {
		return
	}
	revision, err := h.service.PlaceCourseLesson(
		r.Context(),
		auth.User,
		chi.URLParam(r, "id"),
		chi.URLParam(r, "moduleId"),
		chi.URLParam(r, "lessonId"),
		input,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"courseRevision": revision})
}

func (h *Handler) removeCourseLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.RevisionInput
	if !decodeJSON(w, r, &input) {
		return
	}
	revision, err := h.service.RemoveCourseLesson(
		r.Context(),
		auth.User,
		chi.URLParam(r, "id"),
		chi.URLParam(r, "moduleId"),
		chi.URLParam(r, "lessonId"),
		input,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"courseRevision": revision})
}

func (h *Handler) getTopicPlacements(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	placements, err := h.service.TopicPlacements(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"placements": presentTopicPlacements(placements)})
}

func (h *Handler) linkTopicLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.PlacementInput
	if !decodeJSON(w, r, &input) {
		return
	}
	revision, err := h.service.LinkTopicLesson(r.Context(), auth.User, chi.URLParam(r, "id"), chi.URLParam(r, "lessonId"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"topicRevision": revision})
}

func (h *Handler) unlinkTopicLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.RevisionInput
	if !decodeJSON(w, r, &input) {
		return
	}
	revision, err := h.service.UnlinkTopicLesson(r.Context(), auth.User, chi.URLParam(r, "id"), chi.URLParam(r, "lessonId"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"topicRevision": revision})
}

func (h *Handler) linkTopicLibrary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.PlacementInput
	if !decodeJSON(w, r, &input) {
		return
	}
	revision, err := h.service.LinkTopicLibrary(r.Context(), auth.User, chi.URLParam(r, "id"), chi.URLParam(r, "itemId"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"topicRevision": revision})
}

func (h *Handler) unlinkTopicLibrary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.RevisionInput
	if !decodeJSON(w, r, &input) {
		return
	}
	revision, err := h.service.UnlinkTopicLibrary(r.Context(), auth.User, chi.URLParam(r, "id"), chi.URLParam(r, "itemId"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"topicRevision": revision})
}

func presentCourseModule(row content.CourseModule) map[string]any {
	lessons := make([]map[string]any, 0, len(row.Lessons))
	for _, placement := range row.Lessons {
		lessons = append(lessons, map[string]any{
			"lessonId":  placement.LessonID,
			"sortOrder": placement.SortOrder,
			"isPreview": placement.IsPreview,
		})
	}
	return map[string]any{
		"id": row.ID, "courseId": row.CourseID, "title": row.Title, "description": row.Description,
		"sortOrder": row.SortOrder, "status": row.Status, "lessons": lessons,
		"createdAt": row.CreatedAt, "updatedAt": row.UpdatedAt,
	}
}

func presentTopicPlacements(row content.FoundationPlacements) map[string]any {
	lessons := make([]map[string]any, 0, len(row.Lessons))
	for _, placement := range row.Lessons {
		lessons = append(lessons, map[string]any{"lessonId": placement.LessonID, "sortOrder": placement.SortOrder})
	}
	library := make([]map[string]any, 0, len(row.LibraryItems))
	for _, placement := range row.LibraryItems {
		library = append(library, map[string]any{"libraryItemId": placement.LibraryItemID, "sortOrder": placement.SortOrder})
	}
	return map[string]any{"lessons": lessons, "libraryItems": library}
}
