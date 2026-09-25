package assessmenthttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	app "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
)

type Authenticator interface {
	Authenticate(context.Context, string) (identityapp.Authenticated, error)
	VerifyCSRF(identityapp.Authenticated, string) error
}
type Handler struct {
	service     *app.Service
	auth        Authenticator
	attempts    *app.AttemptService
	assignments *app.AssignmentService
}

type writeInput struct {
	ExpectedRevision  int                            `json:"expectedRevision"`
	Code              string                         `json:"code"`
	OwnerType         assessment.OwnerType           `json:"ownerType"`
	OwnerUserID       string                         `json:"ownerUserId"`
	OwnerSchoolID     string                         `json:"ownerSchoolId"`
	AssignedTeacherID string                         `json:"assignedTeacherId"`
	IsVisible         bool                           `json:"isVisible"`
	Version           assessment.Version             `json:"version"`
	Sections          []assessment.Section           `json:"sections"`
	Questions         []assessment.QuestionPlacement `json:"questions"`
}
type workflowInput struct {
	ExpectedRevision int                       `json:"expectedRevision"`
	Status           assessment.WorkflowStatus `json:"status"`
	ReviewerNotes    string                    `json:"reviewerNotes"`
}
type publicationInput struct {
	ExpectedRevision int  `json:"expectedRevision"`
	Published        bool `json:"published"`
}

func New(service *app.Service, auth Authenticator, attemptServices ...*app.AttemptService) http.Handler {
	return NewWithAssignments(service, auth, nil, attemptServices...)
}
func NewWithAssignments(service *app.Service, auth Authenticator, assignmentService *app.AssignmentService, attemptServices ...*app.AttemptService) http.Handler {
	h := &Handler{service: service, auth: auth, assignments: assignmentService}
	if len(attemptServices) > 0 {
		h.attempts = attemptServices[0]
	}
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/{id}", h.get)
	r.Patch("/{id}", h.update)
	r.Post("/{id}/workflow", h.workflow)
	r.Post("/{id}/publication", h.publication)
	r.Post("/{id}/attempts", h.startAttempt)
	r.Get("/{id}/assignments", h.listAssignments)
	r.Post("/{id}/assignments", h.createAssignment)
	return r
}
func (h *Handler) authenticate(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, 503, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	a, e := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if e != nil {
		writeJSON(w, 401, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	if csrf && h.auth.VerifyCSRF(a, r.Header.Get("X-CSRF-Token")) != nil {
		writeJSON(w, 403, map[string]string{"message": "Invalid CSRF token"})
		return identityapp.Authenticated{}, false
	}
	return a, true
}
func decode(w http.ResponseWriter, r *http.Request, d any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
	x := json.NewDecoder(r.Body)
	x.DisallowUnknownFields()
	if x.Decode(d) != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid request"})
		return false
	}
	return true
}
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	page, err := atoi(r.URL.Query().Get("page"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	limit, err := atoi(r.URL.Query().Get("limit"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	out, e := h.service.List(r.Context(), a.User, assessment.ListQuery{Page: page, Limit: limit, PathID: r.URL.Query().Get("pathId"), SubjectID: r.URL.Query().Get("subjectId"), WorkflowStatus: assessment.WorkflowStatus(r.URL.Query().Get("workflowStatus")), Search: r.URL.Query().Get("search")})
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, out)
}
func atoi(s string) (int, error) {
	if strings.TrimSpace(s) == "" {
		return 0, nil
	}
	v, e := strconv.Atoi(s)
	if e != nil || v < 1 {
		return 0, errors.New("invalid")
	}
	return v, nil
}
func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	x, e := h.service.Get(r.Context(), a.User, chi.URLParam(r, "id"))
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"assessment": x})
}
func toWrite(i writeInput) assessment.Write {
	return assessment.Write{Code: i.Code, OwnerType: i.OwnerType, OwnerUserID: i.OwnerUserID, OwnerSchoolID: i.OwnerSchoolID, AssignedTeacherID: i.AssignedTeacherID, IsVisible: i.IsVisible, Version: i.Version, Sections: i.Sections, Questions: i.Questions}
}
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var i writeInput
	if !decode(w, r, &i) {
		return
	}
	x, e := h.service.Create(r.Context(), a.User, toWrite(i))
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 201, map[string]any{"assessment": x})
}
func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var i writeInput
	if !decode(w, r, &i) {
		return
	}
	x, e := h.service.Update(r.Context(), a.User, chi.URLParam(r, "id"), i.ExpectedRevision, toWrite(i))
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"assessment": x})
}
func (h *Handler) workflow(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var i workflowInput
	if !decode(w, r, &i) {
		return
	}
	x, e := h.service.SetWorkflow(r.Context(), a.User, chi.URLParam(r, "id"), i.ExpectedRevision, i.Status, i.ReviewerNotes)
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"assessment": x})
}
func (h *Handler) publication(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var i publicationInput
	if !decode(w, r, &i) {
		return
	}
	x, e := h.service.SetPublication(r.Context(), a.User, chi.URLParam(r, "id"), i.ExpectedRevision, i.Published)
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"assessment": x})
}
func writeError(w http.ResponseWriter, e error) {
	switch {
	case errors.Is(e, app.ErrInvalidInput):
		writeJSON(w, 400, map[string]string{"message": "Invalid assessment request"})
	case errors.Is(e, app.ErrForbidden):
		writeJSON(w, 403, map[string]string{"message": "Forbidden"})
	case errors.Is(e, assessment.ErrNotFound):
		writeJSON(w, 404, map[string]string{"message": "Assessment not found"})
	case errors.Is(e, app.ErrWorkflow), errors.Is(e, assessment.ErrConflict), errors.Is(e, assessment.ErrVersionConflict):
		writeJSON(w, 409, map[string]string{"message": "Assessment state conflicts with requested operation"})
	default:
		writeJSON(w, 500, map[string]string{"message": "Internal server error"})
	}
}
func writeJSON(w http.ResponseWriter, status int, b any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(b)
}

func (h *Handler) startAttempt(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	if h.attempts == nil {
		writeJSON(w, 503, map[string]string{"message": "Attempt service unavailable"})
		return
	}
	var in struct {
		StartKey string `json:"startKey"`
	}
	if !decode(w, r, &in) {
		return
	}
	x, e := h.attempts.Start(r.Context(), a.User, chi.URLParam(r, "id"), in.StartKey)
	if e != nil {
		writeAttemptError(w, e)
		return
	}
	writeJSON(w, 201, map[string]any{"attempt": x})
}

func (h *Handler) listAssignments(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	if h.assignments == nil {
		writeJSON(w, 503, map[string]string{"message": "Assignment service unavailable"})
		return
	}
	page, e := atoi(r.URL.Query().Get("page"))
	if e != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	limit, e := atoi(r.URL.Query().Get("limit"))
	if e != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	x, e := h.assignments.List(r.Context(), a.User, chi.URLParam(r, "id"), page, limit)
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, x)
}
func (h *Handler) createAssignment(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	if h.assignments == nil {
		writeJSON(w, 503, map[string]string{"message": "Assignment service unavailable"})
		return
	}
	var in assessment.AssignmentWrite
	if !decode(w, r, &in) {
		return
	}
	x, e := h.assignments.Create(r.Context(), a.User, chi.URLParam(r, "id"), in)
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 201, map[string]any{"assignment": x})
}
