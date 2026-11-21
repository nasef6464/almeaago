package assessmenthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	assessmentapp "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
)

type QuizzesHandler struct {
	service *assessmentapp.CompletionService
	auth    Authenticator
	attempt *assessmentapp.AttemptService
}

func NewQuizzes(service *assessmentapp.CompletionService, auth Authenticator, attempt ...*assessmentapp.AttemptService) http.Handler {
	var attemptService *assessmentapp.AttemptService
	if len(attempt) > 0 {
		attemptService = attempt[0]
	}
	h := &QuizzesHandler{service: service, auth: auth, attempt: attemptService}
	r := chi.NewRouter()
	r.Get("/learning-completion", h.learningCompletion)
	r.Post("/{id}/submit", h.singleShotSubmit)
	return r
}

func (h *QuizzesHandler) singleShotSubmit(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	if h.attempt == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Assessment attempt service unavailable"})
		return
	}
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return
	}
	auth, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
		return
	}
	if h.auth.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")) != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
		return
	}
	assessmentID := chi.URLParam(r, "id")
	var input assessment.SingleShotSubmissionRequest
	if !decode(w, r, &input) {
		return
	}
	result, err := h.attempt.SingleShotSubmit(r.Context(), auth.User, assessmentID, input)
	if err != nil {
		writeAttemptError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (h *QuizzesHandler) learningCompletion(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return
	}
	auth, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
		return
	}

	pathID := r.URL.Query().Get("pathId")
	if pathID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "pathId is required"})
		return
	}
	subjectID := r.URL.Query().Get("subjectId")

	resp, err := h.service.GetLearningCompletion(r.Context(), auth.User.ID, pathID, subjectID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}
