package assessmenthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	app "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
)

type PlacementHandler struct {
	service *app.PlacementService
	auth    Authenticator
}

func NewPlacements(service *app.PlacementService, auth Authenticator) http.Handler {
	h := &PlacementHandler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/available", h.available)
	r.Patch("/{id}", h.patch)
	r.Post("/{id}/start", h.start)
	return r
}

func (h *PlacementHandler) authn(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	a, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	if csrf && h.auth.VerifyCSRF(a, r.Header.Get("X-CSRF-Token")) != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
		return identityapp.Authenticated{}, false
	}
	return a, true
}

func (h *PlacementHandler) available(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	page, err := atoi(r.URL.Query().Get("page"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid pagination"})
		return
	}
	limit, err := atoi(r.URL.Query().Get("limit"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid pagination"})
		return
	}
	out, err := h.service.Learner(r.Context(), a.User, assessment.LearnerPlacementQuery{
		Page: page, Limit: limit,
		Slot: assessment.PlacementSlot(r.URL.Query().Get("slot")),
		PathID: r.URL.Query().Get("pathId"), SubjectID: r.URL.Query().Get("subjectId"),
		CourseID: r.URL.Query().Get("courseId"), LessonID: r.URL.Query().Get("lessonId"), TopicID: r.URL.Query().Get("topicId"),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *PlacementHandler) patch(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in assessment.PlacementPatch
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.Patch(r.Context(), a.User, chi.URLParam(r, "id"), in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"placement": out})
}

func (h *PlacementHandler) start(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in struct {
		StartKey string `json:"startKey"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.Start(r.Context(), a.User, chi.URLParam(r, "id"), in.StartKey)
	if err != nil {
		writeAttemptError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"attempt": out})
}
