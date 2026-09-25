package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Dependencies struct {
	Logger             *slog.Logger
	DB                 *pgxpool.Pool
	Redis              *redis.Client
	Identity           http.Handler
	Organizations      http.Handler
	Parents            http.Handler
	Taxonomy           http.Handler
	QuestionBank       http.Handler
	Media              http.Handler
	Courses            http.Handler
	Lessons            http.Handler
	Foundation         http.Handler
	Library            http.Handler
	LegacySchoolAccess http.Handler
}

func New(addr string, deps Dependencies) *http.Server {
	router := chi.NewRouter()
	router.Use(
		middleware.RequestID,
		middleware.RealIP,
		middleware.Recoverer,
		middleware.Compress(5),
		requestLogger(deps.Logger),
	)

	router.Get("/health/live", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "service": "almeaa-api"})
	})

	router.Get("/health/ready", func(w http.ResponseWriter, req *http.Request) {
		ctx, cancel := context.WithTimeout(req.Context(), 2*time.Second)
		defer cancel()

		if err := deps.DB.Ping(ctx); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{"status": "not_ready", "dependency": "postgres"})
			return
		}
		if err := deps.Redis.Ping(ctx).Err(); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{"status": "not_ready", "dependency": "redis"})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"status": "ready"})
	})

	if deps.Identity != nil {
		router.Mount("/api/v1/auth", deps.Identity)
	}
	if deps.Organizations != nil {
		router.Mount("/api/v1/schools", deps.Organizations)
	}
	if deps.Parents != nil {
		router.Mount("/api/v1/parents", deps.Parents)
	}
	if deps.Taxonomy != nil {
		router.Mount("/api/v1/taxonomy", deps.Taxonomy)
	}
	if deps.QuestionBank != nil {
		router.Mount("/api/v1/questions", deps.QuestionBank)
	}
	if deps.Media != nil {
		router.Mount("/api/v1/media", deps.Media)
	}
	if deps.Courses != nil {
		router.Mount("/api/v1/courses", deps.Courses)
	}
	if deps.Lessons != nil {
		router.Mount("/api/v1/lessons", deps.Lessons)
	}
	if deps.Foundation != nil {
		router.Mount("/api/v1/foundation", deps.Foundation)
	}
	if deps.Library != nil {
		router.Mount("/api/v1/library", deps.Library)
	}
	if deps.LegacySchoolAccess != nil {
		router.Mount("/api/school-access", deps.LegacySchoolAccess)
	}

	return &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			started := time.Now()
			next.ServeHTTP(w, r)
			logger.Info(
				"http_request",
				"method", r.Method,
				"path", r.URL.Path,
				"request_id", middleware.GetReqID(r.Context()),
				"duration_ms", time.Since(started).Milliseconds(),
			)
		})
	}
}
