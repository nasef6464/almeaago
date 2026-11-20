package assessmenthttp

import (
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	"net/http"
)

func (h *PlacementHandler) subjectAccessGuide(w http.ResponseWriter, r *http.Request) {
	var actor identity.User
	if h.auth != nil {
		if authenticated, err := h.auth.Authenticate(r.Context(), identitysession.Token(r)); err == nil {
			actor = authenticated.User
		}
	}
	out, err := h.service.SubjectAccessGuide(r.Context(), actor, r.URL.Query().Get("pathId"), r.URL.Query().Get("subjectId"))
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, out)
}
