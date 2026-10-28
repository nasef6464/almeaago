package discoveryhttp

import (
	"context"
	"errors"
	"github.com/go-chi/chi/v5"
	discoveryapp "github.com/nasef6464/almeaago/internal/discovery/application"
	discovery "github.com/nasef6464/almeaago/internal/discovery/domain"
	"net/http"
	"strconv"
)

type ArticleLister interface {
	List(context.Context, int, int) (discovery.ArticlePage, error)
}

func NewArticles(service ArticleLister) http.Handler {
	router := chi.NewRouter()
	router.Get("/", func(w http.ResponseWriter, r *http.Request) {
		params := r.URL.Query()
		page, limit := 1, 20
		for _, key := range []string{"page", "limit"} {
			if values, exists := params[key]; exists {
				if len(values) != 1 {
					writeJSON(w, 400, map[string]string{"message": "Invalid article pagination"})
					return
				}
				number, err := strconv.Atoi(values[0])
				if err != nil || number < 1 || (key == "limit" && number > 100) {
					writeJSON(w, 400, map[string]string{"message": "Invalid article pagination"})
					return
				}
				if key == "page" {
					page = number
				} else {
					limit = number
				}
			}
		}
		out, err := service.List(r.Context(), page, limit)
		if err != nil {
			if errors.Is(err, discoveryapp.ErrInvalidInput) {
				writeJSON(w, 400, map[string]string{"message": "Invalid article pagination"})
			} else {
				writeJSON(w, 500, map[string]string{"message": "Articles unavailable"})
			}
			return
		}
		writeJSON(w, 200, out)
	})
	return router
}
