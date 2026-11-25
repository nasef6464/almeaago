package learninghttp

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type EvidenceHandler struct {
	service *learningapp.EvidenceService
	auth    Authenticator
}

func NewEvidenceHandler(service *learningapp.EvidenceService, auth Authenticator) http.Handler {
	h := &EvidenceHandler{service: service, auth: auth}
	return http.HandlerFunc(h.serve)
}

func (h *EvidenceHandler) authn(w http.ResponseWriter, r *http.Request) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	authenticated, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	return authenticated, true
}

func (h *EvidenceHandler) serve(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	days, err := parseOptionalPositiveInt(q.Get("days"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid days parameter"})
		return
	}
	page, err := parseOptionalPositiveInt(q.Get("page"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid page parameter"})
		return
	}
	limit, err := parseOptionalPositiveInt(q.Get("limit"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid limit parameter"})
		return
	}
	out, err := h.service.Read(r.Context(), authenticated.User, learning.LearningEvidenceQuery{
		Source:    q.Get("source"),
		SubjectID: q.Get("subjectId"),
		Search:    q.Get("search"),
		PathID:    q.Get("pathId"),
		SchoolID:  q.Get("schoolId"),
		ClassID:   q.Get("classId"),
		QuizID:    q.Get("quizId"),
		Days:      days,
		Page:      page,
		Limit:     limit,
		Status:    q.Get("status"),
	})
	if err != nil {
		switch {
		case errors.Is(err, learningapp.ErrInvalidInput):
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid learning evidence query"})
		case errors.Is(err, learningapp.ErrForbidden):
			writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
		}
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func parseOptionalPositiveInt(raw string) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < 1 {
		return 0, learningapp.ErrInvalidInput
	}
	return v, nil
}
