package organizationshttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type Authenticator interface {
	Authenticate(ctx context.Context, rawToken string) (identityapp.Authenticated, error)
	VerifyCSRF(auth identityapp.Authenticated, rawToken string) error
}

type Handler struct {
	service *orgapp.Service
	auth    Authenticator
}

func New(service *orgapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()

	r.Get("/context", h.schoolContexts)
	r.Get("/", h.listSchools)
	r.Post("/", h.createSchool)
	r.Get("/{schoolId}", h.schoolByID)
	r.Patch("/{schoolId}", h.updateSchool)
	r.Delete("/{schoolId}", h.archiveSchool)

	r.Get("/{schoolId}/classes", h.listClasses)
	r.Post("/{schoolId}/classes", h.createClass)
	r.Patch("/{schoolId}/classes/{classId}", h.updateClass)
	r.Delete("/{schoolId}/classes/{classId}", h.archiveClass)

	r.Get("/{schoolId}/roster", h.roster)

	r.Put("/{schoolId}/memberships", h.upsertMembership)
	r.Get("/{schoolId}/directors", h.listDirectors)
	r.Put("/{schoolId}/directors/{userId}", h.upsertDirector)
	r.Get("/{schoolId}/assignments", h.listAssignments)
	r.Put("/{schoolId}/assignments", h.upsertAssignment)

	return r
}

type schoolResponse struct {
	ID        string          `json:"id"`
	Code      string          `json:"code"`
	Name      string          `json:"name"`
	Status    string          `json:"status"`
	Metadata  json.RawMessage `json:"metadata"`
	CreatedAt string          `json:"createdAt"`
	UpdatedAt string          `json:"updatedAt"`
}

type classResponse struct {
	ID        string          `json:"id"`
	SchoolID  string          `json:"schoolId"`
	Code      string          `json:"code"`
	Name      string          `json:"name"`
	Status    string          `json:"status"`
	Metadata  json.RawMessage `json:"metadata"`
	CreatedAt string          `json:"createdAt"`
	UpdatedAt string          `json:"updatedAt"`
}

func (h *Handler) listSchools(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	query, err := parseSchoolQuery(r)
	if err != nil {
		writeError(w, err)
		return
	}
	page, err := h.service.ListSchools(r.Context(), auth.User, query)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]schoolResponse, 0, len(page.Schools))
	for _, school := range page.Schools {
		items = append(items, presentSchool(school))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"schools":    items,
		"pagination": pagination(page.Page, page.Limit, page.Total),
	})
}

func (h *Handler) createSchool(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Code     string          `json:"code"`
		Name     string          `json:"name"`
		Metadata json.RawMessage `json:"metadata"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	school, err := h.service.CreateSchool(r.Context(), auth.User, orgapp.CreateSchoolInput{
		Code: payload.Code, Name: payload.Name, Metadata: payload.Metadata,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"school": presentSchool(school)})
}

func (h *Handler) schoolByID(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	school, err := h.service.SchoolByID(r.Context(), auth.User, chi.URLParam(r, "schoolId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"school": presentSchool(school)})
}

func (h *Handler) updateSchool(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Name     *string                 `json:"name"`
		Status   *orgdomain.SchoolStatus `json:"status"`
		Metadata *json.RawMessage        `json:"metadata"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	school, err := h.service.UpdateSchool(r.Context(), auth.User, chi.URLParam(r, "schoolId"), orgapp.UpdateSchoolInput{
		Name: payload.Name, Status: payload.Status, Metadata: payload.Metadata,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"school": presentSchool(school)})
}

func (h *Handler) archiveSchool(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	school, err := h.service.ArchiveSchool(r.Context(), auth.User, chi.URLParam(r, "schoolId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"school": presentSchool(school)})
}

func (h *Handler) listClasses(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	query, err := parseClassQuery(r)
	if err != nil {
		writeError(w, err)
		return
	}
	page, err := h.service.ListClasses(r.Context(), auth.User, chi.URLParam(r, "schoolId"), query)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]classResponse, 0, len(page.Classes))
	for _, classroom := range page.Classes {
		items = append(items, presentClass(classroom))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"classes":    items,
		"pagination": pagination(page.Page, page.Limit, page.Total),
	})
}

func (h *Handler) createClass(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Code     string          `json:"code"`
		Name     string          `json:"name"`
		Metadata json.RawMessage `json:"metadata"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	classroom, err := h.service.CreateClass(r.Context(), auth.User, chi.URLParam(r, "schoolId"), orgapp.CreateClassInput{
		Code: payload.Code, Name: payload.Name, Metadata: payload.Metadata,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"class": presentClass(classroom)})
}

func (h *Handler) updateClass(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		Name     *string                `json:"name"`
		Status   *orgdomain.ClassStatus `json:"status"`
		Metadata *json.RawMessage       `json:"metadata"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	classroom, err := h.service.UpdateClass(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		chi.URLParam(r, "classId"),
		orgapp.UpdateClassInput{Name: payload.Name, Status: payload.Status, Metadata: payload.Metadata},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"class": presentClass(classroom)})
}

func (h *Handler) archiveClass(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	classroom, err := h.service.ArchiveClass(
		r.Context(),
		auth.User,
		chi.URLParam(r, "schoolId"),
		chi.URLParam(r, "classId"),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"class": presentClass(classroom)})
}

func (h *Handler) roster(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	query, err := parseRosterQuery(r)
	if err != nil {
		writeError(w, err)
		return
	}
	page, err := h.service.Roster(r.Context(), auth.User, chi.URLParam(r, "schoolId"), query)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"members":    page.Members,
		"pagination": pagination(page.Page, page.Limit, page.Total),
	})
}

func (h *Handler) authenticate(
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

func parseSchoolQuery(r *http.Request) (orgdomain.SchoolListQuery, error) {
	var q orgdomain.SchoolListQuery
	if err := parsePageLimit(r, &q.Page, &q.Limit); err != nil {
		return q, err
	}
	q.Search = strings.TrimSpace(r.URL.Query().Get("search"))
	if raw := strings.TrimSpace(r.URL.Query().Get("status")); raw != "" {
		status := orgdomain.SchoolStatus(raw)
		q.Status = &status
	}
	return q, nil
}

func parseClassQuery(r *http.Request) (orgdomain.ClassListQuery, error) {
	var q orgdomain.ClassListQuery
	if err := parsePageLimit(r, &q.Page, &q.Limit); err != nil {
		return q, err
	}
	q.Search = strings.TrimSpace(r.URL.Query().Get("search"))
	if raw := strings.TrimSpace(r.URL.Query().Get("status")); raw != "" {
		status := orgdomain.ClassStatus(raw)
		q.Status = &status
	}
	return q, nil
}

func parseRosterQuery(r *http.Request) (orgdomain.RosterQuery, error) {
	var q orgdomain.RosterQuery
	if err := parsePageLimit(r, &q.Page, &q.Limit); err != nil {
		return q, err
	}
	q.Search = strings.TrimSpace(r.URL.Query().Get("search"))
	q.ClassID = strings.TrimSpace(r.URL.Query().Get("classId"))
	if raw := strings.TrimSpace(r.URL.Query().Get("role")); raw != "" {
		role := identitydomain.Role(raw)
		q.Role = &role
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("isActive")); raw != "" {
		active, err := strconv.ParseBool(raw)
		if err != nil {
			return q, orgapp.ErrInvalidInput
		}
		q.Active = &active
	}
	return q, nil
}

func parsePageLimit(r *http.Request, page, limit *int) error {
	*page = 1
	*limit = 50
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 {
			return orgapp.ErrInvalidInput
		}
		*page = value
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 100 {
			return orgapp.ErrInvalidInput
		}
		*limit = value
	}
	return nil
}

func pagination(page, limit, total int) map[string]int {
	totalPages := 0
	if total > 0 {
		totalPages = (total + limit - 1) / limit
	}
	return map[string]int{
		"page": page, "limit": limit, "total": total, "totalPages": totalPages,
	}
}

func presentSchool(school orgdomain.School) schoolResponse {
	return schoolResponse{
		ID: school.ID, Code: school.Code, Name: school.Name, Status: string(school.Status),
		Metadata: school.Metadata, CreatedAt: school.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: school.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func presentClass(classroom orgdomain.Class) classResponse {
	return classResponse{
		ID: classroom.ID, SchoolID: classroom.SchoolID, Code: classroom.Code, Name: classroom.Name,
		Status: string(classroom.Status), Metadata: classroom.Metadata,
		CreatedAt: classroom.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: classroom.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request"})
		return false
	}
	return true
}

func writeIdentityError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, identityapp.ErrUnauthenticated):
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
	case errors.Is(err, identityapp.ErrCSRF):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
	case errors.Is(err, identityapp.ErrAccountDisabled):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Account is disabled"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, orgapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request"})
	case errors.Is(err, orgapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, orgdomain.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Organization record not found"})
	case errors.Is(err, orgdomain.ErrConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "Organization record conflicts with an existing record"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
