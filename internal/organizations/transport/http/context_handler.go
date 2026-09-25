package organizationshttp

import (
	"net/http"

	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type schoolContextResponse struct {
	SchoolID    string   `json:"schoolId"`
	SchoolName  string   `json:"schoolName"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
	Source      string   `json:"source"`
}

func (h *Handler) schoolContexts(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	contexts, err := h.service.SchoolContexts(r.Context(), auth.User)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]schoolContextResponse, 0, len(contexts))
	for _, context := range contexts {
		items = append(items, presentSchoolContext(context))
	}
	writeJSON(w, http.StatusOK, map[string]any{"contexts": items})
}

func presentSchoolContext(context orgdomain.SchoolContext) schoolContextResponse {
	permissions := context.Permissions
	if permissions == nil {
		permissions = []string{}
	}
	return schoolContextResponse{
		SchoolID:    context.SchoolID,
		SchoolName:  context.SchoolName,
		Role:        string(context.Role),
		Permissions: permissions,
		Source:      context.Source,
	}
}
