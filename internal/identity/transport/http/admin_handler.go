package identityhttp

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/nasef6464/almeaago/internal/identity/application"
	"github.com/nasef6464/almeaago/internal/identity/domain"
)

type optionalAdminString struct {
	Present bool
	Value   string
}

func (o *optionalAdminString) UnmarshalJSON(data []byte) error {
	o.Present = true
	if string(data) == "null" {
		o.Value = ""
		return nil
	}
	return json.Unmarshal(data, &o.Value)
}

type adminUserResponse struct {
	userResponse
	IsActive          bool            `json:"isActive"`
	SchoolID          string          `json:"schoolId,omitempty"`
	GroupIDs          []string        `json:"groupIds"`
	LinkedStudentIDs  []string        `json:"linkedStudentIds"`
	ManagedPathIDs    []string        `json:"managedPathIds"`
	ManagedSubjectIDs []string        `json:"managedSubjectIds"`
	SchoolContexts    []schoolContext `json:"schoolContexts"`
}

type schoolContext struct {
	SchoolID    string      `json:"schoolId"`
	Role        domain.Role `json:"role"`
	Permissions []string    `json:"permissions"`
}

func (h *Handler) adminListUsers(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.adminAuthenticate(w, r, false)
	if !ok {
		return
	}

	query, err := parseAdminUserQuery(r)
	if err != nil {
		writeApplicationError(w, application.ErrInvalidInput)
		return
	}
	page, err := h.admin.ListUsers(r.Context(), auth.User, query)
	if err != nil {
		writeApplicationError(w, err)
		return
	}

	users := make([]adminUserResponse, 0, len(page.Users))
	for _, record := range page.Users {
		users = append(users, presentAdminRecord(record))
	}

	totalPages := 0
	if page.Total > 0 {
		totalPages = (page.Total + page.Limit - 1) / page.Limit
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"users": users,
		"pagination": map[string]int{
			"page":       page.Page,
			"limit":      page.Limit,
			"total":      page.Total,
			"totalPages": totalPages,
		},
	})
}

func (h *Handler) adminUsersSummary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.adminAuthenticate(w, r, false)
	if !ok {
		return
	}

	summary, err := h.admin.Summary(r.Context(), auth.User)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"total":            summary.Total,
		"inactive":         summary.Inactive,
		"byRole":           summary.ByRole,
		"platformTrainers": summary.PlatformTrainers,
	})
}

func (h *Handler) adminUpsertUser(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.adminAuthenticate(w, r, true)
	if !ok {
		return
	}

	var payload struct {
		Name              string      `json:"name"`
		Email             string      `json:"email"`
		Password          string      `json:"password"`
		Role              domain.Role `json:"role"`
		SchoolID          *string     `json:"schoolId"`
		GroupIDs          []string    `json:"groupIds"`
		LinkedStudentIDs  []string    `json:"linkedStudentIds"`
		ManagedPathIDs    []string    `json:"managedPathIds"`
		ManagedSubjectIDs []string    `json:"managedSubjectIds"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	schoolID := ""
	if payload.SchoolID != nil {
		schoolID = *payload.SchoolID
	}
	record, err := h.admin.UpsertUser(
		r.Context(),
		auth.User,
		payload.Name,
		payload.Email,
		payload.Password,
		payload.Role,
		schoolID,
		payload.GroupIDs,
		payload.LinkedStudentIDs,
		payload.ManagedPathIDs,
		payload.ManagedSubjectIDs,
	)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"user": presentAdminRecord(record)})
}

func (h *Handler) adminUpdateUser(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.adminAuthenticate(w, r, true)
	if !ok {
		return
	}

	var payload struct {
		Name              *string             `json:"name"`
		Avatar            *string             `json:"avatar"`
		Role              *domain.Role        `json:"role"`
		IsActive          *bool               `json:"isActive"`
		SchoolID          optionalAdminString `json:"schoolId"`
		GroupIDs          *[]string           `json:"groupIds"`
		LinkedStudentIDs  *[]string           `json:"linkedStudentIds"`
		ManagedPathIDs    *[]string           `json:"managedPathIds"`
		ManagedSubjectIDs *[]string           `json:"managedSubjectIds"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	var schoolID *string
	if payload.SchoolID.Present {
		value := payload.SchoolID.Value
		schoolID = &value
	}

	record, err := h.admin.UpdateUser(
		r.Context(),
		auth.User,
		chi.URLParam(r, "id"),
		domain.AdminUpdateUserInput{
			Name:             payload.Name,
			AvatarURL:        payload.Avatar,
			Role:             payload.Role,
			Active:           payload.IsActive,
			SchoolID:         schoolID,
			ClassIDs:          payload.GroupIDs,
			LinkedStudentIDs:  payload.LinkedStudentIDs,
			ManagedPathIDs:    payload.ManagedPathIDs,
			ManagedSubjectIDs: payload.ManagedSubjectIDs,
		},
	)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": presentAdminRecord(record)})
}

func (h *Handler) adminBulkStatus(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.adminAuthenticate(w, r, true)
	if !ok {
		return
	}

	var payload struct {
		UserIDs  []string `json:"userIds"`
		IsActive bool     `json:"isActive"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	results, err := h.admin.BulkStatus(
		r.Context(),
		auth.User,
		payload.UserIDs,
		payload.IsActive,
	)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

func (h *Handler) adminDeleteUser(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.adminAuthenticate(w, r, true)
	if !ok {
		return
	}

	if err := h.admin.DeleteUser(r.Context(), auth.User, chi.URLParam(r, "id")); err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) adminAuthenticate(
	w http.ResponseWriter,
	r *http.Request,
	requireCSRF bool,
) (application.Authenticated, bool) {
	if h.admin == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"message": "Admin identity service is unavailable",
		})
		return application.Authenticated{}, false
	}

	auth, ok := h.authenticate(w, r)
	if !ok {
		return application.Authenticated{}, false
	}
	if requireCSRF {
		if err := h.service.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")); err != nil {
			writeApplicationError(w, err)
			return application.Authenticated{}, false
		}
	}
	return auth, true
}

func parseAdminUserQuery(r *http.Request) (domain.AdminUserQuery, error) {
	values := r.URL.Query()
	query := domain.AdminUserQuery{
		Page:   1,
		Limit:  50,
		Search: strings.TrimSpace(values.Get("search")),
	}

	if raw := strings.TrimSpace(values.Get("page")); raw != "" {
		page, err := strconv.Atoi(raw)
		if err != nil || page < 1 {
			return domain.AdminUserQuery{}, application.ErrInvalidInput
		}
		query.Page = page
	}
	if raw := strings.TrimSpace(values.Get("limit")); raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 100 {
			return domain.AdminUserQuery{}, application.ErrInvalidInput
		}
		query.Limit = limit
	}
	if raw := strings.TrimSpace(values.Get("role")); raw != "" {
		role := domain.Role(raw)
		if !domain.ValidRole(role) {
			return domain.AdminUserQuery{}, application.ErrInvalidInput
		}
		query.Role = &role
	}
	if raw := strings.TrimSpace(values.Get("isActive")); raw != "" {
		active, err := strconv.ParseBool(raw)
		if err != nil {
			return domain.AdminUserQuery{}, application.ErrInvalidInput
		}
		query.Active = &active
	}
	if raw := strings.TrimSpace(values.Get("platformTrainer")); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			return domain.AdminUserQuery{}, application.ErrInvalidInput
		}
		query.PlatformTrainer = &value
	}
	if len(query.Search) > 120 {
		return domain.AdminUserQuery{}, application.ErrInvalidInput
	}

	return query, nil
}

func presentAdminRecord(record domain.AdminUserRecord) adminUserResponse {
	base := presentUser(record.User)
	contexts := make([]schoolContext, 0, 1)
	if record.SchoolID != "" {
		contexts = append(contexts, schoolContext{
			SchoolID:    record.SchoolID,
			Role:        base.Role,
			Permissions: []string{},
		})
	}
	if record.ClassIDs == nil {
		record.ClassIDs = []string{}
	}
	if record.LinkedStudentIDs == nil {
		record.LinkedStudentIDs = []string{}
	}
	if record.ManagedPathIDs == nil {
		record.ManagedPathIDs = []string{}
	}
	if record.ManagedSubjectIDs == nil {
		record.ManagedSubjectIDs = []string{}
	}
	return adminUserResponse{
		userResponse:       base,
		IsActive:           record.User.Status == "active",
		SchoolID:           record.SchoolID,
		GroupIDs:           record.ClassIDs,
		LinkedStudentIDs:   record.LinkedStudentIDs,
		ManagedPathIDs:     record.ManagedPathIDs,
		ManagedSubjectIDs:  record.ManagedSubjectIDs,
		SchoolContexts:     contexts,
	}
}
