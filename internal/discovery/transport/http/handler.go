package discoveryhttp

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/go-chi/chi/v5"
	discoveryapp "github.com/nasef6464/almeaago/internal/discovery/application"
	discovery "github.com/nasef6464/almeaago/internal/discovery/domain"
	"net/http"
	"strconv"
)

type Searcher interface {
	Search(context.Context, discovery.Query) (discovery.Payload, error)
}

// New serves the same public preview contract to guests and signed-in actors.
// Search never grants access to destinations or protected underlying content.
func New(service Searcher) http.Handler {
	router := chi.NewRouter()
	router.Get("/", func(w http.ResponseWriter, r *http.Request) {
		params := r.URL.Query()
		in := discovery.Query{Q: params.Get("q"), Type: "all", Limit: 20}
		for _, key := range []string{"q", "type", "limit"} {
			if len(params[key]) > 1 {
				writeJSON(w, 400, map[string]string{"message": "Invalid search query"})
				return
			}
		}
		if value, ok := params["type"]; ok {
			in.Type = value[0]
		}
		switch in.Type {
		case "all", "course", "lesson", "question":
		default:
			writeJSON(w, 400, map[string]string{"message": "Invalid search type"})
			return
		}
		if value, ok := params["limit"]; ok {
			limit, err := strconv.Atoi(value[0])
			if err != nil || limit < 1 || limit > 20 {
				writeJSON(w, 400, map[string]string{"message": "Invalid search limit"})
				return
			}
			in.Limit = limit
		}
		out, err := service.Search(r.Context(), in)
		if err != nil {
			if errors.Is(err, discoveryapp.ErrInvalidInput) {
				writeJSON(w, 400, map[string]string{"message": "Invalid search query"})
			} else {
				writeJSON(w, 500, map[string]string{"message": "Search unavailable"})
			}
			return
		}
		writeJSON(w, 200, out)
	})
	return router
}
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
