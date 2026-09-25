package contenthttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
)

type Authenticator interface {
	Authenticate(ctx context.Context, rawToken string) (identityapp.Authenticated, error)
	VerifyCSRF(auth identityapp.Authenticated, rawToken string) error
}

type Handler struct {
	service *contentapp.Service
	auth    Authenticator
}

func (h *Handler) authenticate(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	auth, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	if csrf {
		if err := h.auth.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
			return identityapp.Authenticated{}, false
		}
	}
	return auth, true
}

func parseListQuery(w http.ResponseWriter, r *http.Request) (content.ListQuery, bool) {
	page, ok := parsePositiveInt(w, r.URL.Query().Get("page"))
	if !ok {
		return content.ListQuery{}, false
	}
	limit, ok := parsePositiveInt(w, r.URL.Query().Get("limit"))
	if !ok {
		return content.ListQuery{}, false
	}
	return content.ListQuery{
		Page: page, Limit: limit, PathID: r.URL.Query().Get("pathId"), SubjectID: r.URL.Query().Get("subjectId"),
		Search: r.URL.Query().Get("search"), WorkflowStatus: content.WorkflowStatus(r.URL.Query().Get("workflowStatus")),
	}, true
}

func parseTopicQuery(w http.ResponseWriter, r *http.Request) (content.TopicQuery, bool) {
	page, ok := parsePositiveInt(w, r.URL.Query().Get("page"))
	if !ok {
		return content.TopicQuery{}, false
	}
	limit, ok := parsePositiveInt(w, r.URL.Query().Get("limit"))
	if !ok {
		return content.TopicQuery{}, false
	}
	return content.TopicQuery{
		Page: page, Limit: limit, PathID: r.URL.Query().Get("pathId"), SubjectID: r.URL.Query().Get("subjectId"),
		ParentID: r.URL.Query().Get("parentId"), Search: r.URL.Query().Get("search"), Status: content.TopicStatus(r.URL.Query().Get("status")),
	}, true
}

func parsePositiveInt(w http.ResponseWriter, raw string) (int, bool) {
	if strings.TrimSpace(raw) == "" {
		return 0, true
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid pagination"})
		return 0, false
	}
	return value, true
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request"})
		return false
	}
	return true
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, contentapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid content request"})
	case errors.Is(err, contentapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, content.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Content not found"})
	case errors.Is(err, contentapp.ErrWorkflow), errors.Is(err, content.ErrConflict), errors.Is(err, content.ErrInvalidTaxonomy), errors.Is(err, content.ErrInvalidAsset), errors.Is(err, content.ErrVersionConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "Content state conflicts with the requested operation"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}
