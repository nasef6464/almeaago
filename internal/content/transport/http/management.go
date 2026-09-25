package contenthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
)

func NewManagement(service *contentapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/trainer-scopes/{userId}", h.getTrainerScope)
	r.Put("/trainer-scopes/{userId}", h.setTrainerScope)
	return r
}

func (h *Handler) getTrainerScope(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	scope, err := h.service.TrainerScope(r.Context(), auth.User, chi.URLParam(r, "userId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"scope": presentTrainerScope(scope)})
}

func (h *Handler) setTrainerScope(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.TrainerScopeInput
	if !decodeJSON(w, r, &input) {
		return
	}
	scope, err := h.service.SetTrainerScope(r.Context(), auth.User, chi.URLParam(r, "userId"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"scope": presentTrainerScope(scope)})
}

func presentTrainerScope(scope content.TrainerScope) map[string]any {
	pathIDs := scope.PathIDs
	if pathIDs == nil {
		pathIDs = []string{}
	}
	subjectIDs := scope.SubjectIDs
	if subjectIDs == nil {
		subjectIDs = []string{}
	}
	return map[string]any{
		"userId":     scope.UserID,
		"pathIds":    pathIDs,
		"subjectIds": subjectIDs,
	}
}
