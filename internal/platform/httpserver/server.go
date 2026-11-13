package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Dependencies struct {
	Logger                   *slog.Logger
	AllowedOrigins           string
	DB                       *pgxpool.Pool
	Redis                    *redis.Client
	Identity                 http.Handler
	Organizations            http.Handler
	SchoolContracts          http.Handler
	Classroom                http.Handler
	Parents                  http.Handler
	Taxonomy                 http.Handler
	QuestionBank             http.Handler
	Assessments              http.Handler
	AssessmentAttempts       http.Handler
	AssessmentAssignments    http.Handler
	AssessmentPlacements     http.Handler
	AssessmentSessions       http.Handler
	PublicAssessmentSessions http.Handler
	Media                    http.Handler
	Courses                  http.Handler
	Lessons                  http.Handler
	Foundation               http.Handler
	Library                  http.Handler
	ContentManagement        http.Handler
	LearningSpaces           http.Handler
	LearningReview           http.Handler
	Mastery                  http.Handler
	LearningProgress         http.Handler
	StudyPlans               http.Handler
	Interventions            http.Handler
	Notifications            http.Handler
	Reports                  http.Handler
	Operations               http.Handler
	AI                       http.Handler
	Commerce                 http.Handler
	LegacySchoolAccess       http.Handler
	Search                   http.Handler
	PublicArticles           http.Handler
	PublicMockExams          http.Handler
	NavigationPreferences    http.Handler
	Quizzes                  http.Handler
}

func New(addr string, deps Dependencies) *http.Server {
	router := chi.NewRouter()
	router.Use(
		middleware.RequestID,
		middleware.RealIP,
		middleware.Recoverer,
		middleware.Compress(5),
		securityHeaders,
		corsAllowList(deps.AllowedOrigins),
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
	if deps.SchoolContracts != nil {
		router.Mount("/api/v1/school-contracts", deps.SchoolContracts)
		// Dual-mount contract route at /api/v1/schools/{schoolId}/contract with identical behavior
		schoolContractBridge := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			schoolID := chi.URLParam(r, "schoolId")
			reqCtx := context.WithValue(r.Context(), chi.RouteCtxKey, chi.NewRouteContext())
			adaptedReq := r.WithContext(reqCtx)
			adaptedReq.URL.Path = "/" + schoolID
			adaptedReq.URL.RawPath = "/" + schoolID
			deps.SchoolContracts.ServeHTTP(w, adaptedReq)
		})
		router.Get("/api/v1/schools/{schoolId}/contract", schoolContractBridge)
		router.Put("/api/v1/schools/{schoolId}/contract", schoolContractBridge)
	}
	if deps.Organizations != nil {
		router.Mount("/api/v1/schools", deps.Organizations)
	}
	if deps.Classroom != nil {
		router.Mount("/api/v1/classroom", deps.Classroom)
	}
	if deps.Parents != nil {
		router.Mount("/api/v1/parents", deps.Parents)
	}
	if deps.Taxonomy != nil {
		router.Mount("/api/v1/taxonomy", deps.Taxonomy)
	}
	if deps.Search != nil {
		router.Mount("/api/v1/search", deps.Search)
	}
	if deps.PublicArticles != nil {
		router.Mount("/api/v1/public/articles", deps.PublicArticles)
	}
	if deps.PublicMockExams != nil {
		router.Handle("/api/v1/public/mock-exams", deps.PublicMockExams)
	}
	if deps.NavigationPreferences != nil {
		router.Handle("/api/v1/learning/navigation-preferences", deps.NavigationPreferences)
	}
	if deps.QuestionBank != nil {
		router.Mount("/api/v1/questions", deps.QuestionBank)
	}
	if deps.Assessments != nil {
		router.Mount("/api/v1/assessments", deps.Assessments)
	}
	if deps.Quizzes != nil {
		router.Mount("/api/v1/quizzes", deps.Quizzes)
		router.Mount("/api/quizzes", deps.Quizzes)
	}
	if deps.AssessmentAttempts != nil {
		router.Mount("/api/v1/assessment-attempts", deps.AssessmentAttempts)
	}
	if deps.AssessmentAssignments != nil {
		router.Mount("/api/v1/assessment-assignments", deps.AssessmentAssignments)
	}
	if deps.AssessmentPlacements != nil {
		router.Mount("/api/v1/assessment-placements", deps.AssessmentPlacements)
	}
	if deps.AssessmentSessions != nil {
		router.Mount("/api/v1/assessment-sessions", deps.AssessmentSessions)
	}
	if deps.PublicAssessmentSessions != nil {
		router.Mount("/api/v1/public-assessments", deps.PublicAssessmentSessions)
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
	if deps.ContentManagement != nil {
		router.Mount("/api/v1/content", deps.ContentManagement)
	}
	if deps.LearningSpaces != nil {
		router.Mount("/api/v1/learning-spaces", deps.LearningSpaces)
	}
	if deps.LearningReview != nil {
		router.Mount("/api/v1/review", deps.LearningReview)
	}
	if deps.Mastery != nil {
		router.Mount("/api/v1/mastery", deps.Mastery)
	}
	if deps.LearningProgress != nil {
		router.Mount("/api/v1/learning-progress", deps.LearningProgress)
	}
	if deps.StudyPlans != nil {
		router.Mount("/api/v1/study-plans", deps.StudyPlans)
	}
	if deps.Interventions != nil {
		router.Mount("/api/v1/interventions", deps.Interventions)
	}
	if deps.Notifications != nil {
		router.Mount("/api/v1/notifications", deps.Notifications)
	}
	if deps.Reports != nil {
		router.Mount("/api/v1/reports", deps.Reports)
	}
	if deps.Operations != nil {
		router.Mount("/api/v1/operations", deps.Operations)
	}
	if deps.AI != nil {
		router.Mount("/api/v1/ai", deps.AI)
	}
	if deps.Commerce != nil {
		router.Mount("/api/v1/commerce", deps.Commerce)
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

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := w.Header()
		header.Set("X-Content-Type-Options", "nosniff")
		header.Set("X-Frame-Options", "DENY")
		header.Set("Referrer-Policy", "no-referrer")
		header.Set("Cross-Origin-Resource-Policy", "same-origin")
		header.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		// The API only emits JSON/CSV; it never renders documents, so the
		// strictest policy is safe here and blocks injected markup from loading.
		header.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
		if r.TLS != nil || strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https") {
			header.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		next.ServeHTTP(w, r)
	})
}

// corsAllowList only reflects origins explicitly configured for the deployment.
// The public web app normally proxies /api through its own origin, so this is a
// narrow allowance for direct-origin tooling rather than a permissive wildcard.
func corsAllowList(rawOrigins string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{})
	for _, value := range strings.Split(rawOrigins, ",") {
		origin := strings.TrimRight(strings.TrimSpace(value), "/")
		if origin != "" {
			allowed[origin] = struct{}{}
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.TrimSpace(r.Header.Get("Origin"))
			normalized := strings.TrimRight(origin, "/")
			_, originAllowed := allowed[normalized]

			if origin != "" && originAllowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Add("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, X-CSRF-Token, X-Request-Id")
				w.Header().Set("Access-Control-Max-Age", "600")
			}

			if r.Method == http.MethodOptions {
				if origin != "" && !originAllowed {
					http.Error(w, "origin not allowed", http.StatusForbidden)
					return
				}
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
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
