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

type optionalString struct {
	Present bool
	Value   string
}

func (o *optionalString) UnmarshalJSON(data []byte) error {
	o.Present = true
	if string(data) == "null" {
		o.Value = ""
		return nil
	}
	return json.Unmarshal(data, &o.Value)
}

type adminUserResponse struct {
	userResponse
	IsActive         bool            `json:"isActive"`
	SchoolID         string          `json:"schoolId,omitempty"`
	GroupIDs         []string        `json:"groupIds"`
	LinkedStudentIDs []string        `json:"linkedStudentIds"`
	SchoolContexts   []schoolContext `json:"schoolContexts"`
}

type schoolContext struct {
	SchoolID    string      `json:"schoolId"`
	Role        domain.Role `json:"role"`
	Permissions []string    `json:"permissions"`
}

func (h *Handler) adminCreateUser(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.requireMutationAuth(w, r)
	if !ok {
		return
	}

	var payload struct {
		Name             string      `json:"name"`
		Email            string      `json:"email"`
		Password         string      `json:"password"`
		Role             domain.Role `json:"role"`
		SchoolID         string      `json:"schoolId"`
		GroupIDs         []string    `json:"groupIds"`
		LinkedStudentIDs []string    `json:"linkedStudentIds"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	record, err := h.service.AdminCreateUser(r.Context(), auth, application.AdminCreateUserInput{
		Name:             payload.Name,
		Email:            payload.Email,
		Password:         payload.Password,
		Role:             payload.Role,
		SchoolID:         payload.SchoolID,
		ClassIDs:         payload.GroupIDs,
		LinkedStudentIDs: payload.LinkedStudentIDs,
	})
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"user": presentAdminRecord(record)})
}

func (h *Handler) adminUpdateUser(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.requireMutationAuth(w, r)
	if !ok {
		return
	}

	var payload struct {
		Name             *string         `json:"name"`
		Avatar           *string         `json:"avatar"`
		Role             *domain.Role    `json:"role"`
		IsActive         *bool           `json:"isActive"`
		SchoolID         optionalString  `json:"schoolId"`
		GroupIDs         *[]string       `json:"groupIds"`
		LinkedStudentIDs *[]string       `json:"linkedStudentIds"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	var schoolID *string
	if payload.SchoolID.Present {
		value := payload.SchoolID.Value
		schoolID = &value
	}

	record, err := h.service.AdminUpdateUser(
		r.Context(),
		auth,
		chi.URLParam(r, "id"),
		application.AdminUpdateUserInput{
			Name:             payload.Name,
			AvatarURL:        payload.Avatar,
			Role:             payload.Role,
			Active:           payload.IsActive,
			SchoolID:         schoolID,
			ClassIDs:         payload.GroupIDs,
			LinkedStudentIDs: payload.LinkedStudentIDs,
		},
	)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": presentAdminRecord(record)})
}

func (h *Handler) adminDeleteUser(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.requireMutationAuth(w, r)
	if !ok {
		return
	}

	if err := h.service.AdminDeleteUser(r.Context(), auth, chi.URLParam(r, "id")); err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) adminBulkStatus(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.requireMutationAuth(w, r)
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

	results, err := h.service.AdminBulkStatus(r.Context(), auth, payload.UserIDs, payload.IsActive)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

func (h *Handler) adminListUsers(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	query := r.URL.Query()
	page, err := positiveInt(query.Get("page"), 1, 1_000_000)
	if err != nil {
		writeApplicationError(w, application.ErrInvalidInput)
		return
	}
	limit, err := positiveInt(query.Get("limit"), 50, 100)
	if err != nil {
		writeApplicationError(w, application.ErrInvalidInput)
		return
	}

	var role *domain.Role
	if value := strings.TrimSpace(query.Get("role")); value != "" {
		parsed := domain.Role(value)
		role = &parsed
	}
	active, err := optionalBool(query.Get("isActive"))
	if err != nil {
		writeApplicationError(w, application.ErrInvalidInput)
		return
	}

	result, err := h.service.AdminListUsers(r.Context(), auth, application.AdminUserListInput{
		Page:   page,
		Limit:  limit,
		Search: query.Get("search"),
		Role:   role,
		Active: active,
	})
	if err != nil {
		writeApplicationError(w, err)
		return
	}

	users := make([]adminUserResponse, 0, len(result.Users))
	for _, record := range result.Users {
		users = append(users, presentAdminRecord(record))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"users": users,
		"pagination": map[string]int{
			"page":       result.Page,
			"limit":      result.Limit,
			"total":      result.Total,
			"totalPages": result.TotalPages,
		},
	})
}

func (h *Handler) adminSummary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	summary, err := h.service.AdminSummary(r.Context(), auth)
	if err != nil {
		writeApplicationError(w, err)
		return
	}

	byRole := make(map[string]int, len(summary.ByRole))
	for role, count := range summary.ByRole {
		byRole[string(role)] = count
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"total":            summary.Total,
		"byRole":           byRole,
		"inactive":         summary.Inactive,
		"platformTrainers": summary.PlatformTrainers,
	})
}

func (h *Handler) requireMutationAuth(w http.ResponseWriter, r *http.Request) (application.Authenticated, bool) {
	auth, ok := h.authenticate(w, r)
	if !ok {
		return application.Authenticated{}, false
	}
	if err := h.service.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")); err != nil {
		writeApplicationError(w, err)
		return application.Authenticated{}, false
	}
	return auth, true
}

func presentAdminRecord(record domain.AdminUserRecord) adminUserResponse {
	base := presentUser(record.User)
	role := base.Role
	contexts := make([]schoolContext, 0, 1)
	if record.SchoolID != "" {
		contexts = append(contexts, schoolContext{
			SchoolID:    record.SchoolID,
			Role:        role,
			Permissions: []string{},
		})
	}
	if record.ClassIDs == nil {
		record.ClassIDs = []string{}
	}
	if record.LinkedStudentIDs == nil {
		record.LinkedStudentIDs = []string{}
	}

	return adminUserResponse{
		userResponse:      base,
		IsActive:         record.User.Status == "active",
		SchoolID:         record.SchoolID,
		GroupIDs:         record.ClassIDs,
		LinkedStudentIDs: record.LinkedStudentIDs,
		SchoolContexts:   contexts,
	}
}

func positiveInt(raw string, fallback, max int) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 || value > max {
		return 0, application.ErrInvalidInput
	}
	return value, nil
}

func optionalBool(raw string) (*bool, error) {
	value := strings.TrimSpace(strings.ToLower(raw))
	if value == "" {
		return nil, nil
	}
	switch value {
	case "true":
		result := true
		return &result, nil
	case "false":
		result := false
		return &result, nil
	default:
		return nil, application.ErrInvalidInput
	}
}
