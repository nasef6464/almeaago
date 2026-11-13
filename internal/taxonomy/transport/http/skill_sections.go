package taxonomyhttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

func (h *Handler) createSkillSection(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticateMutation(w, r)
	if !ok {
		return
	}
	var input taxonomy.SkillSectionWrite
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.CreateSkillSection(r.Context(), auth.User, input)
	if err != nil {
		writeMutation(w, http.StatusCreated, nil, err)
		return
	}
	writeMutation(w, http.StatusCreated, map[string]any{"section": presentSkillSections([]taxonomy.SkillSection{row}, true)[0]}, nil)
}

func (h *Handler) updateSkillSection(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticateMutation(w, r)
	if !ok {
		return
	}
	var patch taxonomy.SkillSectionPatch
	if !decodeJSON(w, r, &patch) {
		return
	}
	row, err := h.service.UpdateSkillSection(r.Context(), auth.User, chi.URLParam(r, "id"), patch)
	if err != nil {
		writeMutation(w, http.StatusOK, nil, err)
		return
	}
	writeMutation(w, http.StatusOK, map[string]any{"section": presentSkillSections([]taxonomy.SkillSection{row}, true)[0]}, nil)
}

func (h *Handler) setSkillSection(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticateMutation(w, r)
	if !ok {
		return
	}
	var input struct {
		SectionID *string `json:"sectionId"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if input.SectionID == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "sectionId is required; use an empty string to clear"})
		return
	}
	row, err := h.service.SetSkillSection(r.Context(), auth.User, chi.URLParam(r, "id"), *input.SectionID)
	if err != nil {
		writeMutation(w, http.StatusOK, nil, err)
		return
	}
	writeMutation(w, http.StatusOK, map[string]any{"skill": skillResponse{ID: row.ID, SubjectID: row.SubjectID, SectionID: row.SectionID, ParentSkillID: row.ParentSkillID, Code: row.Code, Name: row.Name, Description: row.Description, Kind: row.Kind, SortOrder: row.SortOrder}}, nil)
}
