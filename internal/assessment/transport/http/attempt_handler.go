package assessmenthttp

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	app "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
)

type AttemptHandler struct {
	service *app.AttemptService
	auth    Authenticator
}

func NewAttempts(s *app.AttemptService, a Authenticator) http.Handler {
	h := &AttemptHandler{service: s, auth: a}
	r := chi.NewRouter()
	r.Get("/results", h.results)
	r.Get("/{id}", h.get)
	r.Put("/{id}/answers/{questionId}", h.save)
	r.Post("/{id}/submit", h.submit)
	r.Get("/{id}/result", h.result)
	r.Get("/{id}/review", h.resultDetail)
	return r
}

func (h *AttemptHandler) authn(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
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

func (h *AttemptHandler) results(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
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
	x, e := h.service.Results(r.Context(), a.User, page, limit)
	if e != nil {
		writeAttemptError(w, e)
		return
	}
	writeJSON(w, 200, x)
}

func (h *AttemptHandler) get(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	x, e := h.service.Get(r.Context(), a.User, chi.URLParam(r, "id"))
	if e != nil {
		writeAttemptError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"attempt": x})
}

func (h *AttemptHandler) save(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in assessment.AnswerWrite
	if !decode(w, r, &in) {
		return
	}
	x, e := h.service.Save(r.Context(), a.User, chi.URLParam(r, "id"), chi.URLParam(r, "questionId"), in)
	if e != nil {
		writeAttemptError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"attempt": x})
}

func (h *AttemptHandler) submit(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in struct {
		SubmissionKey string `json:"submissionKey"`
	}
	if !decode(w, r, &in) {
		return
	}
	x, e := h.service.Submit(r.Context(), a.User, chi.URLParam(r, "id"), in.SubmissionKey)
	if e != nil {
		writeAttemptError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"result": x})
}

func (h *AttemptHandler) result(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	x, e := h.service.Result(r.Context(), a.User, chi.URLParam(r, "id"))
	if e != nil {
		writeAttemptError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"result": x})
}

func (h *AttemptHandler) resultDetail(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	x, e := h.service.ResultDetail(r.Context(), a.User, chi.URLParam(r, "id"))
	if e != nil {
		writeAttemptError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"detail": x})
}

func writeAttemptError(w http.ResponseWriter, e error) {
	switch {
	case errors.Is(e, app.ErrInvalidInput):
		writeJSON(w, 400, map[string]string{"message": "Invalid attempt request"})
	case errors.Is(e, app.ErrForbidden):
		writeJSON(w, 403, map[string]string{"message": "Forbidden"})
	case errors.Is(e, assessment.ErrNotFound):
		writeJSON(w, 404, map[string]string{"message": "Attempt not found"})
	case errors.Is(e, assessment.ErrAttemptExpired):
		writeJSON(w, 409, map[string]string{"message": "Attempt expired"})
	case errors.Is(e, assessment.ErrAttemptSubmitted):
		writeJSON(w, 409, map[string]string{"message": "Attempt already submitted"})
	case errors.Is(e, assessment.ErrResultUnavailable):
		writeJSON(w, 409, map[string]string{"message": "Result unavailable"})
	case errors.Is(e, assessment.ErrConflict):
		writeJSON(w, 409, map[string]string{"message": "Attempt conflicts with assessment state"})
	default:
		writeJSON(w, 500, map[string]string{"message": "Internal server error"})
	}
}
