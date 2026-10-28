package organizationshttp

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (h *LegacyHandler) directorOverviewAccess(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	schoolID := chi.URLParam(r, "schoolId")
	if err := h.service.DirectorOverviewAccess(r.Context(), auth.User, schoolID); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"allowed":  true,
		"schoolId": schoolID,
	})
}

func (h *LegacyHandler) directorOverview(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	overview, err := h.service.DirectorOverview(r.Context(), auth.User, chi.URLParam(r, "schoolId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, overview)
}

func (h *LegacyHandler) directorAcademicAssessments(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	workspace, err := h.service.DirectorAcademicAssessments(r.Context(), auth.User, chi.URLParam(r, "schoolId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, workspace)
}

func (h *LegacyHandler) directorAssessmentDefinition(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	if r.URL.RawQuery != "" {
		writeError(w, orgapp.ErrInvalidInput)
		return
	}
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	definition, err := h.service.DirectorAssessmentDefinition(r.Context(), auth.User,
		chi.URLParam(r, "schoolId"), chi.URLParam(r, "assessmentId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, definition)
}

func (h *LegacyHandler) directorAssessmentContext(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	if r.URL.RawQuery != "" {
		writeError(w, orgapp.ErrInvalidInput)
		return
	}
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	schoolID := chi.URLParam(r, "schoolId")
	definition, err := h.service.DirectorAssessmentDefinition(r.Context(), auth.User,
		schoolID, chi.URLParam(r, "assessmentId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id": definition.AssessmentID, "schoolId": schoolID,
		"canManage": definition.CanManage, "canClone": definition.CanClone,
		"canEditContent":      definition.CanEditContent,
		"canManageDefinition": false, "isPublished": definition.IsPublished,
	})
}

func (h *LegacyHandler) directorAssessmentReport(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	report, err := h.service.DirectorAssessmentReport(r.Context(), auth.User,
		chi.URLParam(r, "schoolId"), chi.URLParam(r, "assessmentId"))
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, report)
}

func (h *LegacyHandler) directorAssessmentLearners(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	params := r.URL.Query()
	for key, values := range params {
		if len(values) != 1 || (key != "page" && key != "limit" && key != "status" && key != "search") {
			writeError(w, orgapp.ErrInvalidInput)
			return
		}
	}
	query := orgdomain.DirectorAssessmentLearnerQuery{Page: 1, Limit: 12, Status: params.Get("status"), Search: params.Get("search")}
	if raw, exists := params["page"]; exists {
		value, err := strconv.Atoi(raw[0])
		if err != nil || value < 1 {
			writeError(w, orgapp.ErrInvalidInput)
			return
		}
		query.Page = value
	}
	if raw, exists := params["limit"]; exists {
		value, err := strconv.Atoi(raw[0])
		if err != nil || value < 1 {
			writeError(w, orgapp.ErrInvalidInput)
			return
		}
		query.Limit = value
	}
	result, err := h.service.DirectorAssessmentLearners(r.Context(), auth.User,
		chi.URLParam(r, "schoolId"), chi.URLParam(r, "assessmentId"), query)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, result)
}

func (h *LegacyHandler) directorAssessmentLearnerResult(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	result, err := h.service.DirectorAssessmentLearnerResult(r.Context(), auth.User,
		chi.URLParam(r, "schoolId"), chi.URLParam(r, "assessmentId"), chi.URLParam(r, "attemptId"))
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, result)
}

func (h *LegacyHandler) directorCreateAcademicAssessment(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Title       string                                `json:"title"`
		ClassID     string                                `json:"classId"`
		ClassIDs    []string                              `json:"classIds"`
		StudentIDs  []string                              `json:"studentIds"`
		TargetScope string                                `json:"targetScope"`
		PathID      string                                `json:"pathId"`
		SubjectID   string                                `json:"subjectId"`
		QuestionIDs []string                              `json:"questionIds"`
		Settings    *orgdomain.DirectorAssessmentSettings `json:"settings"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	created, err := h.service.DirectorCreateAssessment(
		r.Context(), auth.User, chi.URLParam(r, "schoolId"),
		orgdomain.DirectorAssessmentCreate{
			Title:       payload.Title,
			ClassID:     payload.ClassID,
			ClassIDs:    payload.ClassIDs,
			StudentIDs:  payload.StudentIDs,
			TargetScope: payload.TargetScope,
			PathID:      payload.PathID,
			SubjectID:   payload.SubjectID,
			QuestionIDs: payload.QuestionIDs,
			RequestKey:  r.Header.Get("Idempotency-Key"),
			Settings:    payload.Settings,
		},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"assessment": created})
}

func (h *LegacyHandler) directorAvailableAssessmentQuestions(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	limit := 30
	pageNumber := 1
	if value := r.URL.Query().Get("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			writeError(w, orgapp.ErrInvalidInput)
			return
		}
		limit = parsed
	}
	if value := r.URL.Query().Get("page"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			writeError(w, orgapp.ErrInvalidInput)
			return
		}
		pageNumber = parsed
	}
	page, err := h.service.DirectorAssessmentQuestions(r.Context(), auth.User,
		chi.URLParam(r, "schoolId"), r.URL.Query().Get("pathId"),
		r.URL.Query().Get("subjectId"), r.URL.Query().Get("search"), pageNumber, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (h *LegacyHandler) directorAssessmentEligibleStudents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	page, limit := 1, 20
	if value := r.URL.Query().Get("page"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			writeError(w, orgapp.ErrInvalidInput)
			return
		}
		page = parsed
	}
	if value := r.URL.Query().Get("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			writeError(w, orgapp.ErrInvalidInput)
			return
		}
		limit = parsed
	}
	result, err := h.service.DirectorAssessmentEligibleStudents(r.Context(), auth.User, chi.URLParam(r, "schoolId"), r.URL.Query().Get("search"), page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *LegacyHandler) directorStudents(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	page, err := h.service.DirectorStudents(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		orgdomain.DirectorStudentQuery{
			Page:   1,
			Limit:  500,
			Search: strings.TrimSpace(r.URL.Query().Get("search")),
		},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	students := make([]map[string]any, 0, len(page.Students))
	for _, student := range page.Students {
		students = append(students, presentLegacyDirectorStudent(student))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"students": students,
		"total":    page.Total,
	})
}

func (h *LegacyHandler) directorAddStudent(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		ClassID  string `json:"classId"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	result, err := h.service.DirectorAddStudent(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		orgdomain.DirectorStudentCreate{
			Name:     payload.Name,
			Email:    payload.Email,
			Password: payload.Password,
			ClassID:  payload.ClassID,
		},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	status := http.StatusOK
	if result.Created {
		status = http.StatusCreated
	}
	writeJSON(w, status, map[string]any{
		"student": presentLegacyDirectorStudent(result.Student),
		"created": result.Created,
	})
}

func (h *LegacyHandler) directorMoveStudent(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		ClassID string `json:"classId"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	result, err := h.service.DirectorMoveStudent(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		chi.URLParam(r, "studentId"),
		payload.ClassID,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"student":    presentLegacyDirectorStudent(result.Student),
		"idempotent": result.Idempotent,
	})
}

func (h *LegacyHandler) directorUpdateStudentBasic(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Name  *string `json:"name"`
		Phone *string `json:"phone"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	result, err := h.service.DirectorUpdateStudentBasic(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		chi.URLParam(r, "studentId"),
		orgdomain.DirectorStudentBasicPatch{
			Name:  payload.Name,
			Phone: payload.Phone,
		},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"student": presentLegacyDirectorStudent(result.Student),
	})
}

func (h *LegacyHandler) directorSetStudentActive(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		IsActive bool `json:"isActive"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	result, err := h.service.DirectorSetStudentActive(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		chi.URLParam(r, "studentId"),
		payload.IsActive,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"student": presentLegacyDirectorStudent(result.Student),
	})
}

func (h *LegacyHandler) directorCreateClass(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Name string `json:"name"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	classroom, err := h.service.CreateClass(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		orgapp.CreateClassInput{Name: payload.Name},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"classroom": map[string]any{
			"classId":   classroom.ID,
			"className": classroom.Name,
		},
	})
}

func (h *LegacyHandler) directorUpdateClass(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Name string `json:"name"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	name := payload.Name
	classroom, err := h.service.UpdateClass(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		chi.URLParam(r, "classId"),
		orgapp.UpdateClassInput{Name: &name},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"classroom": map[string]any{
			"classId":   classroom.ID,
			"className": classroom.Name,
		},
	})
}

func (h *LegacyHandler) directorTeachers(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	workspace, err := h.service.DirectorTeachers(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	teachers := make([]map[string]any, 0, len(workspace.Teachers))
	for _, teacher := range workspace.Teachers {
		teachers = append(teachers, map[string]any{
			"teacherId": teacher.TeacherID,
			"name":      teacher.Name,
			"email":     teacher.Email,
			"isActive":  teacher.Active,
		})
	}
	assignments := make([]map[string]any, 0, len(workspace.Assignments))
	for _, assignment := range workspace.Assignments {
		assignments = append(assignments, presentLegacyAssignment(assignment))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"teachers":    teachers,
		"assignments": assignments,
	})
}

func (h *LegacyHandler) directorUpsertAssignment(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		TeacherID string `json:"teacherId"`
		ClassID   string `json:"classId"`
		SubjectID string `json:"subjectId"`
		Status    string `json:"status"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	status, valid := legacyAssignmentStatus(payload.Status)
	if !valid {
		writeError(w, orgapp.ErrInvalidInput)
		return
	}
	assignment, err := h.service.UpsertAssignment(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		orgapp.UpsertAssignmentInput{
			TeacherID: payload.TeacherID,
			ClassID:   payload.ClassID,
			SubjectID: payload.SubjectID,
			Status:    status,
		},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"assignment": presentLegacyAssignment(assignment),
	})
}

func presentLegacyDirectorStudent(student orgdomain.DirectorStudent) map[string]any {
	var classID any
	var className any
	if student.ClassID != "" {
		classID = student.ClassID
	}
	if student.ClassName != "" {
		className = student.ClassName
	}
	return map[string]any{
		"studentId": student.StudentID,
		"name":      student.Name,
		"email":     student.Email,
		"phone":     student.Phone,
		"isActive":  student.Active,
		"classId":   classID,
		"className": className,
	}
}
