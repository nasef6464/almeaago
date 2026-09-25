package organizationshttp

import (
	"net/http"
	"strings"

	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"

	"github.com/go-chi/chi/v5"
)

type membershipResponse struct {
	ID          string              `json:"id"`
	SchoolID    string              `json:"schoolId"`
	UserID      string              `json:"userId"`
	Role        identitydomain.Role `json:"role"`
	Status      string              `json:"status"`
	Permissions []string            `json:"permissions"`
}

type directorResponse struct {
	Membership membershipResponse `json:"membership"`
	User       struct {
		Name   string `json:"name"`
		Email  string `json:"email"`
		Status string `json:"status"`
	} `json:"user"`
}

type assignmentResponse struct {
	ID        string `json:"id"`
	SchoolID  string `json:"schoolId"`
	TeacherID string `json:"teacherId"`
	ClassID   string `json:"classId"`
	SubjectID string `json:"subjectId"`
	Status    string `json:"status"`
}

func (h *Handler) upsertMembership(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		UserID string                     `json:"userId"`
		Role   identitydomain.Role        `json:"role"`
		Status orgdomain.MembershipStatus `json:"status"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	membership, err := h.service.UpsertMembership(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		orgapp.UpsertMembershipInput{
			UserID: payload.UserID,
			Role:   payload.Role,
			Status: payload.Status,
		},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"membership": presentMembership(membership),
	})
}

func (h *Handler) listDirectors(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}

	var query orgdomain.DirectorQuery
	if err := parsePageLimit(r, &query.Page, &query.Limit); err != nil {
		writeError(w, err)
		return
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("status")); raw != "" {
		status := orgdomain.MembershipStatus(raw)
		query.Status = &status
	}

	page, err := h.service.ListDirectors(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		query,
	)
	if err != nil {
		writeError(w, err)
		return
	}

	directors := make([]directorResponse, 0, len(page.Directors))
	for _, record := range page.Directors {
		directors = append(directors, presentDirector(record))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"permissions": orgdomain.SchoolDirectorPermissions,
		"defaults":    orgdomain.DefaultSchoolDirectorPermissions,
		"directors":   directors,
		"pagination":  pagination(page.Page, page.Limit, page.Total),
	})
}

func (h *Handler) upsertDirector(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}

	var payload struct {
		Status      orgdomain.MembershipStatus `json:"status"`
		Permissions *[]string                  `json:"permissions"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	var permissions []string
	if payload.Permissions != nil {
		permissions = make([]string, len(*payload.Permissions))
		copy(permissions, *payload.Permissions)
	}
	record, err := h.service.UpsertDirector(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		orgapp.UpsertDirectorInput{
			UserID:      chi.URLParam(r, "userId"),
			Status:      payload.Status,
			Permissions: permissions,
		},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"director": presentDirector(record),
	})
}

func (h *Handler) listAssignments(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}

	var query orgdomain.AssignmentQuery
	if err := parsePageLimit(r, &query.Page, &query.Limit); err != nil {
		writeError(w, err)
		return
	}
	query.TeacherID = strings.TrimSpace(r.URL.Query().Get("teacherId"))
	query.ClassID = strings.TrimSpace(r.URL.Query().Get("classId"))
	if values, exists := r.URL.Query()["subjectId"]; exists {
		subjectID := ""
		if len(values) > 0 {
			subjectID = strings.TrimSpace(values[0])
		}
		query.SubjectID = &subjectID
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("status")); raw != "" {
		status := orgdomain.AssignmentStatus(raw)
		query.Status = &status
	}

	page, err := h.service.ListAssignments(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		query,
	)
	if err != nil {
		writeError(w, err)
		return
	}

	assignments := make([]assignmentResponse, 0, len(page.Assignments))
	for _, assignment := range page.Assignments {
		assignments = append(assignments, presentAssignment(assignment))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"assignments": assignments,
		"pagination":  pagination(page.Page, page.Limit, page.Total),
	})
}

func (h *Handler) upsertAssignment(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		TeacherID string                     `json:"teacherId"`
		ClassID   string                     `json:"classId"`
		SubjectID string                     `json:"subjectId"`
		Status    orgdomain.AssignmentStatus `json:"status"`
	}
	if !decodeJSON(w, r, &payload) {
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
			Status:    payload.Status,
		},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"assignment": presentAssignment(assignment),
	})
}

func presentMembership(membership orgdomain.SchoolMembership) membershipResponse {
	permissions := membership.Permissions
	if permissions == nil {
		permissions = []string{}
	}
	return membershipResponse{
		ID:          membership.ID,
		SchoolID:    membership.SchoolID,
		UserID:      membership.UserID,
		Role:        membership.Role,
		Status:      string(membership.Status),
		Permissions: permissions,
	}
}

func presentDirector(record orgdomain.DirectorRecord) directorResponse {
	response := directorResponse{
		Membership: presentMembership(record.Membership),
	}
	response.User.Name = record.UserName
	response.User.Email = record.UserEmail
	response.User.Status = record.UserStatus
	return response
}

func presentAssignment(assignment orgdomain.TeachingAssignment) assignmentResponse {
	return assignmentResponse{
		ID:        assignment.ID,
		SchoolID:  assignment.SchoolID,
		TeacherID: assignment.TeacherID,
		ClassID:   assignment.ClassID,
		SubjectID: assignment.SubjectID,
		Status:    string(assignment.Status),
	}
}
