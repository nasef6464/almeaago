// Package catalog exposes published platform assessment summaries. It never
// authorizes assessment sessions, question reads, attempts or scoring.
package catalog

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
)

type MockSummary struct {
	ID               string `json:"id"`
	PathID           string `json:"pathId"`
	SubjectID        string `json:"subjectId,omitempty"`
	Title            string `json:"title"`
	QuestionCount    int    `json:"questionCount"`
	SectionCount     int    `json:"sectionCount"`
	TimeLimitSeconds int    `json:"timeLimitSeconds"`
}
type Repository interface {
	ListPublicMocks(context.Context) ([]MockSummary, error)
}
type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }
func (s *Service) List(ctx context.Context) ([]MockSummary, error) {
	rows, err := s.repo.ListPublicMocks(ctx)
	if rows == nil {
		rows = []MockSummary{}
	}
	return rows, err
}

// NewHandler mounts at GET /api/v1/public/mock-exams (strip the mount prefix).
func NewHandler(service *Service) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", "GET")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		rows, err := service.List(r.Context())
		if err != nil {
			http.Error(w, "mock catalog unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
		json.NewEncoder(w).Encode(map[string]any{"mocks": rows})
	})
}

type Postgres struct{ db *pgxpool.Pool }

func NewPostgres(db *pgxpool.Pool) *Postgres { return &Postgres{db: db} }
func (r *Postgres) ListPublicMocks(ctx context.Context) ([]MockSummary, error) {
	rows, err := r.db.Query(ctx, publicMocksSQL)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []MockSummary{}
	for rows.Next() {
		var row MockSummary
		if err := rows.Scan(&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.QuestionCount, &row.SectionCount, &row.TimeLimitSeconds); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

// Read only the canonical published version. Recursive ancestry hides descendants
// of inactive/archived paths; counts never join question bodies or answer tables.
const publicMocksSQL = `
 WITH RECURSIVE active_paths AS (
 SELECT id FROM paths WHERE parent_path_id IS NULL AND status='active'
 UNION ALL SELECT p.id FROM paths p JOIN active_paths a ON p.parent_path_id=a.id WHERE p.status='active'
 )
 SELECT a.id::text,v.path_id::text,COALESCE(v.subject_id::text,''),v.title,
 (SELECT count(*) FROM assessment_version_questions q WHERE q.assessment_id=a.id AND q.assessment_version=a.published_version),
 (SELECT count(*) FROM assessment_sections s WHERE s.assessment_id=a.id AND s.assessment_version=a.published_version),
 COALESCE(NULLIF((SELECT sum(s.time_limit_seconds) FROM assessment_sections s WHERE s.assessment_id=a.id AND s.assessment_version=a.published_version),0),v.time_limit_seconds,3600)::integer
 FROM assessments a JOIN assessment_versions v ON v.assessment_id=a.id AND v.version=a.published_version
 JOIN active_paths p ON p.id=v.path_id
 LEFT JOIN subjects sub ON sub.id=v.subject_id
 LEFT JOIN levels l ON l.id=sub.level_id
 WHERE a.owner_type='platform' AND a.workflow_status='approved' AND a.is_published AND a.is_visible
 AND v.version_status='published' AND v.assessment_kind='mock'
 AND (v.subject_id IS NULL OR (sub.path_id=v.path_id AND sub.status='active' AND (sub.level_id IS NULL OR l.status='active')))
 ORDER BY a.created_at,a.id`
