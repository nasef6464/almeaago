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

func presentBootstrap(value taxonomy.Bootstrap) map[string]any {
	return map[string]any{
		"paths": value.Paths,
		"levels": value.Levels,
		"subjects": value.Subjects,
		"skills": value.Skills,
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
