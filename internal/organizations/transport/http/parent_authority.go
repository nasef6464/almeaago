package organizationshttp

import "net/http"

type parentAuthorityResponse struct {
	StudentIDs    []string                    `json:"studentIds"`
	Relationships []parentRelationshipResponse `json:"relationships"`
}

type parentRelationshipResponse struct {
	ID        string `json:"id"`
	StudentID string `json:"studentId"`
	SchoolID  string `json:"schoolId,omitempty"`
	Source    string `json:"source"`
}

func (h *Handler) parentAuthority(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	authority, err := h.service.ParentAuthority(r.Context(), auth.User)
	if err != nil {
		writeError(w, err)
		return
	}

	response := parentAuthorityResponse{
		StudentIDs:    make([]string, 0, len(authority.Relationships)),
		Relationships: make([]parentRelationshipResponse, 0, len(authority.Relationships)),
	}
	for _, relationship := range authority.Relationships {
		response.StudentIDs = append(response.StudentIDs, relationship.StudentID)
		response.Relationships = append(response.Relationships, parentRelationshipResponse{
			ID:        relationship.ID,
			StudentID: relationship.StudentID,
			SchoolID:  relationship.SchoolID,
			Source:    relationship.Source,
		})
	}
	writeJSON(w, http.StatusOK, response)
}
