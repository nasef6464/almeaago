package contenthttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
)

type Authenticator interface {
	Authenticate(ctx context.Context, rawToken string) (identityapp.Authenticated, error)
	VerifyCSRF(auth identityapp.Authenticated, rawToken string) error
}

type Handlers struct {
	Courses    http.Handler
	Lessons    http.Handler
	Foundation http.Handler
	Library    http.Handler
}

type handler struct {
	service *contentapp.Service
	auth    Authenticator
}

func New(service *contentapp.Service, auth Authenticator) Handlers {
	h := &handler{service: service, auth: auth}
	return Handlers{
		Courses:    h.courseRoutes(),
		Lessons:    h.lessonRoutes(),
		Foundation: h.foundationRoutes(),
		Library:    h.libraryRoutes(),
	}
}

func (h *handler) courseRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/", h.listCourses)
	r.Post("/", h.createCourse)
	r.Get("/{id}", h.getCourse)
	r.Put("/{id}", h.updateCourse)
	r.Patch("/{id}/workflow", h.courseWorkflow)
	r.Post("/{id}/modules", h.createCourseModule)
	r.Put("/{id}/modules/{moduleId}/lessons/{lessonId}", h.placeCourseLesson)
	return r
}

func (h *handler) lessonRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/", h.listLessons)
	r.Post("/", h.createLesson)
	r.Get("/{id}", h.getLesson)
	r.Put("/{id}", h.updateLesson)
	r.Patch("/{id}/workflow", h.lessonWorkflow)
	return r
}

func (h *handler) foundationRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/", h.listTopics)
	r.Post("/", h.createTopic)
	r.Get("/{id}", h.getTopic)
	r.Put("/{id}", h.updateTopic)
	r.Post("/{id}/archive", h.archiveTopic)
	r.Put("/{id}/lessons/{lessonId}", h.linkTopicLesson)
	r.Put("/{id}/library/{itemId}", h.linkTopicLibrary)
	return r
}

func (h *handler) libraryRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/", h.listLibrary)
	r.Post("/", h.createLibrary)
	r.Get("/{id}", h.getLibrary)
	r.Put("/{id}", h.updateLibrary)
	r.Patch("/{id}/workflow", h.libraryWorkflow)
	return r
}

func (h *handler) listCourses(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	query, ok := parseListQuery(w, r, false)
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
		items = append(items, presentCourse(row, false))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page.Page, "limit": page.Limit, "hasMore": page.HasMore})
}

func (h *handler) createCourse(w http.ResponseWriter, r *http.Request) {
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
	writeJSON(w, http.StatusCreated, map[string]any{"course": presentCourse(row, true)})
}

func (h *handler) getCourse(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.StaffGetCourse(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": presentCourse(row, true)})
}

func (h *handler) updateCourse(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		ExpectedRevision int
		Course           contentapp.CourseInput
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	row, err := h.service.UpdateCourse(r.Context(), auth.User, chi.URLParam(r, "id"), payload.ExpectedRevision, payload.Course)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": presentCourse(row, true)})
}

func (h *handler) courseWorkflow(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var command content.WorkflowCommand
	if !decodeJSON(w, r, &command) {
		return
	}
	row, err := h.service.CourseWorkflow(r.Context(), auth.User, chi.URLParam(r, "id"), command)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": presentCourse(row, true)})
}

func (h *handler) createCourseModule(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Title       string
		Description string
		SortOrder   int
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	row, err := h.service.CreateCourseModule(r.Context(), auth.User, chi.URLParam(r, "id"), payload.Title, payload.Description, payload.SortOrder)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"module": map[string]any{
		"id": row.ID, "courseId": row.CourseID, "title": row.Title, "description": row.Description,
		"sortOrder": row.SortOrder, "status": row.Status, "createdAt": row.CreatedAt, "updatedAt": row.UpdatedAt,
	}})
}

func (h *handler) placeCourseLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		SortOrder int
		IsPreview bool
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	err := h.service.PlaceCourseLesson(r.Context(), auth.User, chi.URLParam(r, "id"), chi.URLParam(r, "moduleId"), chi.URLParam(r, "lessonId"), payload.SortOrder, payload.IsPreview)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "linked"})
}

func (h *handler) listLessons(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	query, ok := parseListQuery(w, r, false)
	if !ok {
		return
	}
	page, err := h.service.ListLessons(r.Context(), auth.User, query)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]map[string]any, 0, len(page.Items))
	for _, row := range page.Items {
		items = append(items, presentLesson(row, false))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page.Page, "limit": page.Limit, "hasMore": page.HasMore})
}

func (h *handler) createLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.LessonInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.CreateLesson(r.Context(), auth.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"lesson": presentLesson(row, true)})
}

func (h *handler) getLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.StaffGetLesson(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lesson": presentLesson(row, true)})
}

func (h *handler) updateLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		ExpectedRevision int
		Lesson           contentapp.LessonInput
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	row, err := h.service.UpdateLesson(r.Context(), auth.User, chi.URLParam(r, "id"), payload.ExpectedRevision, payload.Lesson)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lesson": presentLesson(row, true)})
}

func (h *handler) lessonWorkflow(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var command content.WorkflowCommand
	if !decodeJSON(w, r, &command) {
		return
	}
	row, err := h.service.LessonWorkflow(r.Context(), auth.User, chi.URLParam(r, "id"), command)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lesson": presentLesson(row, true)})
}

func (h *handler) listTopics(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	query, ok := parseListQuery(w, r, true)
	if !ok {
		return
	}
	page, err := h.service.ListTopics(r.Context(), auth.User, query)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]map[string]any, 0, len(page.Items))
	for _, row := range page.Items {
		items = append(items, presentTopic(row, false))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page.Page, "limit": page.Limit, "hasMore": page.HasMore})
}

func (h *handler) createTopic(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.TopicInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.CreateTopic(r.Context(), auth.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"topic": presentTopic(row, true)})
}

func (h *handler) getTopic(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.StaffGetTopic(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"topic": presentTopic(row, true)})
}

func (h *handler) updateTopic(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		ExpectedRevision int
		Topic            contentapp.TopicInput
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	row, err := h.service.UpdateTopic(r.Context(), auth.User, chi.URLParam(r, "id"), payload.ExpectedRevision, payload.Topic)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"topic": presentTopic(row, true)})
}

func (h *handler) archiveTopic(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct{ ExpectedRevision int }
	if !decodeJSON(w, r, &payload) {
		return
	}
	row, err := h.service.ArchiveTopic(r.Context(), auth.User, chi.URLParam(r, "id"), payload.ExpectedRevision)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"topic": presentTopic(row, true)})
}

func (h *handler) linkTopicLesson(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct{ SortOrder int }
	if !decodeJSON(w, r, &payload) {
		return
	}
	err := h.service.LinkTopicLesson(r.Context(), auth.User, chi.URLParam(r, "id"), chi.URLParam(r, "lessonId"), payload.SortOrder)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "linked"})
}

func (h *handler) linkTopicLibrary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct{ SortOrder int }
	if !decodeJSON(w, r, &payload) {
		return
	}
	err := h.service.LinkTopicLibrary(r.Context(), auth.User, chi.URLParam(r, "id"), chi.URLParam(r, "itemId"), payload.SortOrder)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "linked"})
}

func (h *handler) listLibrary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	query, ok := parseListQuery(w, r, false)
	if !ok {
		return
	}
	page, err := h.service.ListLibraryItems(r.Context(), auth.User, query)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]map[string]any, 0, len(page.Items))
	for _, row := range page.Items {
		items = append(items, presentLibrary(row, false))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page.Page, "limit": page.Limit, "hasMore": page.HasMore})
}

func (h *handler) createLibrary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.LibraryInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.CreateLibraryItem(r.Context(), auth.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"libraryItem": presentLibrary(row, true)})
}

func (h *handler) getLibrary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.StaffGetLibraryItem(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"libraryItem": presentLibrary(row, true)})
}

func (h *handler) updateLibrary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		ExpectedRevision int
		LibraryItem      contentapp.LibraryInput
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	row, err := h.service.UpdateLibraryItem(r.Context(), auth.User, chi.URLParam(r, "id"), payload.ExpectedRevision, payload.LibraryItem)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"libraryItem": presentLibrary(row, true)})
}

func (h *handler) libraryWorkflow(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var command content.WorkflowCommand
	if !decodeJSON(w, r, &command) {
		return
	}
	row, err := h.service.LibraryWorkflow(r.Context(), auth.User, chi.URLParam(r, "id"), command)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"libraryItem": presentLibrary(row, true)})
}

func (h *handler) authenticate(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	auth, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	if csrf {
		if err := h.auth.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
			return identityapp.Authenticated{}, false
		}
	}
	return auth, true
}

func parseListQuery(w http.ResponseWriter, r *http.Request, includeStatus bool) (content.ListQuery, bool) {
	query := content.ListQuery{
		Search:    strings.TrimSpace(r.URL.Query().Get("search")),
		PathID:    strings.TrimSpace(r.URL.Query().Get("pathId")),
		SubjectID: strings.TrimSpace(r.URL.Query().Get("subjectId")),
		Workflow:  content.WorkflowStatus(strings.TrimSpace(r.URL.Query().Get("workflow"))),
	}
	if includeStatus {
		query.Status = strings.TrimSpace(r.URL.Query().Get("status"))
		if query.Status != "" && query.Status != "active" && query.Status != "inactive" && query.Status != "archived" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid status filter"})
			return content.ListQuery{}, false
		}
	}
	var err error
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		query.Page, err = strconv.Atoi(raw)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid page"})
			return content.ListQuery{}, false
		}
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		query.Limit, err = strconv.Atoi(raw)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid limit"})
			return content.ListQuery{}, false
		}
	}
	return query, true
}

func presentCourse(row content.Course, detail bool) map[string]any {
	body := map[string]any{
		"id": row.ID, "pathId": row.PathID, "subjectId": row.SubjectID, "title": row.Title,
		"description": row.Description, "instructorName": row.InstructorName, "durationMinutes": row.DurationMinutes,
		"level": row.Level, "isVisible": row.IsVisible, "dripContentEnabled": row.DripContentEnabled,
		"certificateEnabled": row.CertificateEnabled, "thumbnailAssetId": row.ThumbnailAssetID,
		"workflow": presentOwnership(row.Ownership), "presentation": json.RawMessage(row.Presentation),
	}
	if detail {
		body["skillLinks"] = presentSkillLinks(row.SkillLinks)
	}
	return body
}

func presentLesson(row content.Lesson, detail bool) map[string]any {
	body := map[string]any{
		"id": row.ID, "pathId": row.PathID, "subjectId": row.SubjectID, "title": row.Title,
		"description": row.Description, "type": row.LessonType, "contentText": row.ContentText,
		"durationSeconds": row.DurationSeconds, "videoUrl": row.VideoURL, "videoSource": row.VideoSource,
		"meetingUrl": row.MeetingURL, "meetingAt": row.MeetingAt, "recordingUrl": row.RecordingURL,
		"joinInstructions": row.JoinInstructions, "showRecording": row.ShowRecording,
		"isVisible": row.IsVisible, "isLocked": row.IsLocked, "workflow": presentOwnership(row.Ownership),
	}
	if detail {
		body["skillLinks"] = presentSkillLinks(row.SkillLinks)
		body["assets"] = presentAssets(row.Assets)
	}
	return body
}

func presentTopic(row content.FoundationTopic, detail bool) map[string]any {
	body := map[string]any{
		"id": row.ID, "pathId": row.PathID, "subjectId": row.SubjectID, "parentTopicId": row.ParentTopicID,
		"code": row.Code, "title": row.Title, "description": row.Description, "sortOrder": row.SortOrder,
		"isVisible": row.IsVisible, "isLocked": row.IsLocked, "status": row.Status, "revision": row.Revision,
		"createdAt": row.CreatedAt, "updatedAt": row.UpdatedAt,
	}
	if detail {
		body["skillLinks"] = presentSkillLinks(row.SkillLinks)
	}
	return body
}

func presentLibrary(row content.LibraryItem, detail bool) map[string]any {
	body := map[string]any{
		"id": row.ID, "pathId": row.PathID, "subjectId": row.SubjectID, "title": row.Title,
		"description": row.Description, "type": row.ItemType, "externalUrl": row.ExternalURL,
		"isVisible": row.IsVisible, "isLocked": row.IsLocked, "workflow": presentOwnership(row.Ownership),
	}
	if detail {
		body["skillLinks"] = presentSkillLinks(row.SkillLinks)
		body["assets"] = presentAssets(row.Assets)
	}
	return body
}

func presentOwnership(value content.Ownership) map[string]any {
	return map[string]any{
		"ownerType": value.OwnerType, "ownerUserId": value.OwnerUserID, "ownerSchoolId": value.OwnerSchoolID,
		"createdBy": value.CreatedBy, "assignedTeacherId": value.AssignedTeacherID,
		"status": value.WorkflowStatus, "approvedBy": value.ApprovedBy, "approvedAt": value.ApprovedAt,
		"reviewerNotes": value.ReviewerNotes, "revenueSharePercentage": value.RevenueShare,
		"revision": value.Revision, "createdAt": value.CreatedAt, "updatedAt": value.UpdatedAt,
	}
}

func presentSkillLinks(values []content.SkillLink) []map[string]any {
	result := make([]map[string]any, 0, len(values))
	for _, item := range values {
		result = append(result, map[string]any{"skillId": item.SkillID, "relationType": item.RelationType})
	}
	return result
}

func presentAssets(values []content.AssetLink) []map[string]any {
	result := make([]map[string]any, 0, len(values))
	for _, item := range values {
		result = append(result, map[string]any{
			"assetId": item.AssetID, "purpose": item.Purpose, "title": item.Title, "sortOrder": item.SortOrder,
		})
	}
	return result
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 512<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request"})
		return false
	}
	return true
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, contentapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid content request"})
	case errors.Is(err, contentapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, content.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Content record not found"})
	case errors.Is(err, contentapp.ErrWorkflow), errors.Is(err, content.ErrConflict), errors.Is(err, content.ErrInvalidTaxonomy), errors.Is(err, content.ErrVersionConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "Content state conflicts with the requested operation"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
