package taxonomyhttp

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *taxonomyapp.Service
}

func New(service *taxonomyapp.Service) http.Handler {
	h := &Handler{service: service}
	r := chi.NewRouter()
	r.Get("/bootstrap", h.bootstrap)
	return r
}

func (h *Handler) bootstrap(w http.ResponseWriter, r *http.Request) {
	phase := strings.TrimSpace(r.URL.Query().Get("phase"))
	result, err := h.service.PublicBootstrap(r.Context(), phase)
	if errors.Is(err, taxonomyapp.ErrInvalidPhase) {
		http.Error(w, "invalid taxonomy bootstrap phase", http.StatusBadRequest)
		return
	}
	if err != nil {
		http.Error(w, "taxonomy unavailable", http.StatusInternalServerError)
		return
	}

	if phase == "" {
		phase = "full"
	}
	w.Header().Set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
	w.Header().Set("X-Taxonomy-Phase", phase)
	writeJSON(w, http.StatusOK, presentBootstrap(result))
}

type pathResponse struct {
	ID           string `json:"id"`
	Code         string `json:"code"`
	Name         string `json:"name"`
	ParentPathID string `json:"parentPathId,omitempty"`
	Description  string `json:"description"`
	SortOrder    int    `json:"sortOrder"`
}

type levelResponse struct {
	ID        string `json:"id"`
	PathID    string `json:"pathId"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
}

type subjectResponse struct {
	ID        string `json:"id"`
	PathID    string `json:"pathId"`
	LevelID   string `json:"levelId,omitempty"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
}

type skillResponse struct {
	ID            string `json:"id"`
	SubjectID     string `json:"subjectId"`
	ParentSkillID string `json:"parentSkillId,omitempty"`
	Code          string `json:"code"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Kind          string `json:"kind"`
	SortOrder     int    `json:"sortOrder"`
}

func presentBootstrap(value taxonomy.Bootstrap) map[string]any {
	paths := make([]pathResponse, 0, len(value.Paths))
	for _, row := range value.Paths {
		paths = append(paths, pathResponse{row.ID, row.Code, row.Name, row.ParentPathID, row.Description, row.SortOrder})
	}
	levels := make([]levelResponse, 0, len(value.Levels))
	for _, row := range value.Levels {
		levels = append(levels, levelResponse{row.ID, row.PathID, row.Code, row.Name, row.SortOrder})
	}
	subjects := make([]subjectResponse, 0, len(value.Subjects))
	for _, row := range value.Subjects {
		subjects = append(subjects, subjectResponse{row.ID, row.PathID, row.LevelID, row.Code, row.Name, row.SortOrder})
	}
	skills := make([]skillResponse, 0, len(value.Skills))
	for _, row := range value.Skills {
		skills = append(skills, skillResponse{row.ID, row.SubjectID, row.ParentSkillID, row.Code, row.Name, row.Description, row.Kind, row.SortOrder})
	}
	return map[string]any{"paths": paths, "levels": levels, "subjects": subjects, "skills": skills}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
