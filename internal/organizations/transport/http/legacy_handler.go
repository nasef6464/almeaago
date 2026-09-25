package organizationshttp

import (
	"net/http"
	"strings"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"

	"github.com/go-chi/chi/v5"
)

type LegacyHandler struct {
	service *orgapp.Service
	auth    Authenticator
}

func NewLegacy(service *orgapp.Service, auth Authenticator) http.Handler {
	h := &LegacyHandler{service: service, auth: auth}
	r := chi.NewRouter()

	r.Get("/context", h.schoolContexts)
	r.Put("/memberships", h.upsertMembership)
	r.Get("/directors/{schoolId}", h.listDirectors)
	r.Put("/directors/{schoolId}/{userId}", h.upsertDirector)
	r.Put("/assignments", h.upsertAssignment)

	r.Get("/director/schools/{schoolId}/overview-access", h.directorOverviewAccess)
	r.Get("/director/schools/{schoolId}/students", h.directorStudents)
	r.Post("/director/schools/{schoolId}/students", h.directorAddStudent)
	r.Put("/director/schools/{schoolId}/students/{studentId}/class", h.directorMoveStudent)
	r.Patch("/director/schools/{schoolId}/students/{studentId}", h.directorUpdateStudentBasic)
	r.Patch("/director/schools/{schoolId}/students/{studentId}/active", h.directorSetStudentActive)
	r.Post("/director/schools/{schoolId}/classes", h.directorCreateClass)
	r.Patch("/director/schools/{schoolId}/classes/{classId}", h.directorUpdateClass)
	r.Get("/director/schools/{schoolId}/teachers", h.directorTeachers)
	r.Put("/director/schools/{schoolId}/assignments", h.directorUpsertAssignment)

	return r
}

func (h *LegacyHandler) schoolContexts(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	contexts, err := h.service.SchoolContexts(r.Context(), auth.User)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"contexts": contexts})
}

func (h *LegacyHandler) upsertMembership(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		UserID   string              `json:"userId"`
		SchoolID string              `json:"schoolId"`
		Role     identitydomain.Role `json:"role"`
		Status   string              `json:"status"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	status, valid := legacyMembershipStatus(payload.Status)
	if !valid {
		writeError(w, orgapp.ErrInvalidInput)
		return
	}
	membership, err := h.service.UpsertMembership(
		r.Context(),
		auth.User,
		payload.SchoolID,
		orgapp.UpsertMembershipInput{
			UserID: payload.UserID,
			Role:   payload.Role,
			Status: status,
		},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"membership": presentLegacyMembership(membership),
	})
}

func (h *LegacyHandler) listDirectors(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	page, err := h.service.ListDirectors(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		orgdomain.DirectorQuery{Page: 1, Limit: 100},
	)
	if err != nil {
		writeError(w, err)
		return
	}

	directors := make([]map[string]any, 0, len(page.Directors))
	for _, record := range page.Directors {
		directors = append(directors, presentLegacyDirector(record))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"permissions": orgdomain.SchoolDirectorPermissions,
		"defaults":    orgdomain.DefaultSchoolDirectorPermissions,
		"directors":   directors,
	})
}

func (h *LegacyHandler) upsertDirector(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Status      string   `json:"status"`
		Permissions []string `json:"permissions"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	status, valid := legacyDirectorStatus(payload.Status)
	if !valid {
		writeError(w, orgapp.ErrInvalidInput)
		return
	}
	record, err := h.service.UpsertDirector(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		orgapp.UpsertDirectorInput{
			UserID:      chi.URLParam(r, "userId"),
			Status:      status,
			Permissions: payload.Permissions,
		},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"membership": presentLegacyMembership(record.Membership),
	})
}

func (h *LegacyHandler) upsertAssignment(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		SchoolID  string `json:"schoolId"`
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
		payload.SchoolID,
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

func (h *LegacyHandler) authenticate(
	w http.ResponseWriter,
	r *http.Request,
	requireCSRF bool,
) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	auth, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeIdentityError(w, err)
		return identityapp.Authenticated{}, false
	}
	if requireCSRF {
		if err := h.auth.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")); err != nil {
			writeIdentityError(w, err)
			return identityapp.Authenticated{}, false
		}
	}
	return auth, true
}

func legacyMembershipStatus(raw string) (orgdomain.MembershipStatus, bool) {
	switch strings.TrimSpace(raw) {
	case "", "active":
		return orgdomain.MembershipStatusActive, true
	case "inactive":
		return orgdomain.MembershipStatusRevoked, true
	default:
		return "", false
	}
}

func legacyDirectorStatus(raw string) (orgdomain.MembershipStatus, bool) {
	return legacyMembershipStatus(raw)
}

func legacyAssignmentStatus(raw string) (orgdomain.AssignmentStatus, bool) {
	switch strings.TrimSpace(raw) {
	case "", "active":
		return orgdomain.AssignmentStatusActive, true
	case "inactive":
		return orgdomain.AssignmentStatusEnded, true
	default:
		return "", false
	}
}

func presentLegacyMembership(membership orgdomain.SchoolMembership) map[string]any {
	status := "inactive"
	if membership.Status == orgdomain.MembershipStatusActive {
		status = "active"
	}
	permissions := membership.Permissions
	if permissions == nil {
		permissions = []string{}
	}
	return map[string]any{
		"id":          membership.ID,
		"userId":      membership.UserID,
		"schoolId":    membership.SchoolID,
		"role":        membership.Role,
		"status":      status,
		"permissions": permissions,
	}
}

func presentLegacyDirector(record orgdomain.DirectorRecord) map[string]any {
	return map[string]any{
		"userId":      record.Membership.UserID,
		"schoolId":    record.Membership.SchoolID,
		"status":      presentLegacyMembership(record.Membership)["status"],
		"permissions": record.Membership.Permissions,
		"user": map[string]any{
			"id":       record.Membership.UserID,
			"name":     record.UserName,
			"email":    record.UserEmail,
			"role":     identitydomain.RoleSchoolAdmin,
			"isActive": record.UserStatus == "active",
		},
	}
}

func presentLegacyAssignment(assignment orgdomain.TeachingAssignment) map[string]any {
	status := "inactive"
	if assignment.Status == orgdomain.AssignmentStatusActive {
		status = "active"
	}
	return map[string]any{
		"id":           assignment.ID,
		"assignmentId": assignment.ID,
		"schoolId":     assignment.SchoolID,
		"teacherId":    assignment.TeacherID,
		"classId":      assignment.ClassID,
		"subjectId":    assignment.SubjectID,
		"status":       status,
	}
}
