package assessmenthttp

import (
	"github.com/go-chi/chi/v5"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	"net/http"
)

func (h *Handler) listPreparedGroups(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	groups, err := h.service.ListPreparedQuizGroups(r.Context(), a.User)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, 200, map[string]any{"groups": groups})
}
func (h *Handler) createPreparedGroup(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input assessment.PreparedQuizGroup
	if !decode(w, r, &input) {
		return
	}
	g, err := h.service.CreatePreparedQuizGroup(r.Context(), a.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, 201, map[string]any{"group": g})
}
func (h *Handler) listPreparedGroupMembers(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	members, err := h.service.ListPreparedQuizGroupMemberDetails(r.Context(), a.User, chi.URLParam(r, "groupID"))
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	ids := make([]string, 0, len(members))
	for _, member := range members {
		ids = append(ids, member.ID)
	}
	writeJSON(w, 200, map[string]any{"userIds": ids, "members": members})
}
func (h *Handler) changePreparedGroupMember(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	err := h.service.SetPreparedQuizGroupMember(r.Context(), a.User, chi.URLParam(r, "groupID"), chi.URLParam(r, "userID"), r.Method == http.MethodPut)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, 200, map[string]bool{"ok": true})
}
