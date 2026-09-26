package contenthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
)

func NewLearningSpaces(service *contentapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/courses/{id}", h.getLearnerCourse)
	r.Get("/courses/{courseId}/lessons/{lessonId}", h.getLearnerCourseLesson)
	r.Get("/foundation/{id}", h.getLearnerTopic)
	r.Get("/{pathId}/subjects/{subjectId}", h.getLearningSpace)
	return r
}

func (h *Handler) getLearningSpace(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	limit, ok := parsePositiveInt(w, r.URL.Query().Get("limit"))
	if !ok {
		return
	}
	row, err := h.service.LearningSpace(
		r.Context(),
		auth.User,
		chi.URLParam(r, "pathId"),
		chi.URLParam(r, "subjectId"),
		limit,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, presentLearningSpace(row))
}

func (h *Handler) getLearnerCourse(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.LearnerCourse(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": presentLearnerCourse(row)})
}

func (h *Handler) getLearnerTopic(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.LearnerTopic(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"topic": presentLearnerTopic(row)})
}

func presentLearningSpace(row content.LearningSpace) map[string]any {
	courses := make([]map[string]any, 0, len(row.Courses))
	for _, item := range row.Courses {
		courses = append(courses, presentLearnerCourseSummary(item))
	}
	topics := make([]map[string]any, 0, len(row.Foundation))
	for _, item := range row.Foundation {
		topics = append(topics, presentLearnerTopicSummary(item))
	}
	library := make([]map[string]any, 0, len(row.LibraryItems))
	for _, item := range row.LibraryItems {
		library = append(library, presentLearnerLibrarySummary(item))
	}
	return map[string]any{
		"pathId":    row.PathID,
		"subjectId": row.SubjectID,
		"courses": map[string]any{
			"items":   courses,
			"hasMore": row.CoursesHasMore,
		},
		"foundation": map[string]any{
			"items":   topics,
			"hasMore": row.FoundationHasMore,
		},
		"library": map[string]any{
			"items":   library,
			"hasMore": row.LibraryHasMore,
		},
	}
}

func presentLearnerCourse(row content.LearnerCourse) map[string]any {
	modules := make([]map[string]any, 0, len(row.Modules))
	for _, module := range row.Modules {
		lessons := make([]map[string]any, 0, len(module.Lessons))
		for _, lesson := range module.Lessons {
			lessons = append(lessons, presentLearnerLessonSummary(lesson))
		}
		modules = append(modules, map[string]any{
			"id":          module.ID,
			"title":       module.Title,
			"description": module.Description,
			"sortOrder":   module.SortOrder,
			"lessons":     lessons,
		})
	}
	result := presentLearnerCourseSummary(row.Course)
	result["modules"] = modules
	return result
}

func presentLearnerTopic(row content.LearnerTopic) map[string]any {
	result := presentLearnerTopicSummary(row.Topic)
	lessons := make([]map[string]any, 0, len(row.Lessons))
	for _, lesson := range row.Lessons {
		lessons = append(lessons, presentLearnerLessonSummary(lesson))
	}
	library := make([]map[string]any, 0, len(row.LibraryItems))
	for _, item := range row.LibraryItems {
		library = append(library, presentLearnerLibrarySummary(item))
	}
	result["lessons"] = lessons
	result["libraryItems"] = library
	return result
}

func presentLearnerCourseSummary(row content.LearnerCourseSummary) map[string]any {
	return map[string]any{
		"id":                 row.ID,
		"title":              row.Title,
		"description":        row.Description,
		"instructorName":     row.InstructorName,
		"durationMinutes":    row.DurationMinutes,
		"level":              row.Level,
		"thumbnailAssetId":   row.ThumbnailAssetID,
		"dripContentEnabled": row.DripContentEnabled,
		"certificateEnabled": row.CertificateEnabled,
	}
}

func presentLearnerTopicSummary(row content.LearnerTopicSummary) map[string]any {
	return map[string]any{
		"id":            row.ID,
		"parentTopicId": row.ParentTopicID,
		"title":         row.Title,
		"description":   row.Description,
		"sortOrder":     row.SortOrder,
		"isLocked":      row.IsLocked,
	}
}

func presentLearnerLibrarySummary(row content.LearnerLibrarySummary) map[string]any {
	return map[string]any{
		"id":          row.ID,
		"title":       row.Title,
		"description": row.Description,
		"type":        row.ItemType,
		"isLocked":    row.IsLocked,
	}
}

func presentLearnerLessonSummary(row content.LearnerLessonSummary) map[string]any {
	return map[string]any{
		"id":              row.ID,
		"title":           row.Title,
		"description":     row.Description,
		"type":            row.LessonType,
		"durationSeconds": row.DurationSeconds,
		"isLocked":        row.IsLocked,
		"isPreview":       row.IsPreview,
		"sortOrder":       row.SortOrder,
	}
}

func (h *Handler) getLearnerCourseLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.LearnerCourseLesson(r.Context(), auth.User, chi.URLParam(r, "courseId"), chi.URLParam(r, "lessonId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lesson": presentLearnerLessonDetail(row)})
}

func presentLearnerLessonDetail(row content.LearnerLessonDetail) map[string]any {
	result := presentLearnerLessonSummary(row.LearnerLessonSummary)
	result["contentText"] = row.ContentText
	result["videoUrl"] = row.VideoURL
	result["videoSource"] = row.VideoSource
	return result
}
