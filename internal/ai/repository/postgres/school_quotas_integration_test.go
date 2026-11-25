package postgres

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
)

func openAITestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func TestAICircuitBreakersAndSchoolQuotasPostgres(t *testing.T) {
	db := openAITestDB(t)
	ctx := context.Background()
	repo := New(db, operationspg.NewAuditWriter())

	var actorID, schoolID string
	_, _ = db.Exec(ctx, `DELETE FROM users WHERE lower(email) = 'ai-test-admin@example.test'`)
	err := db.QueryRow(ctx, `
		INSERT INTO users (email, name, status)
		VALUES ('ai-test-admin@example.test', 'AI Admin', 'active')
		RETURNING id::text
	`).Scan(&actorID)
	if err != nil {
		t.Fatalf("insert test user: %v", err)
	}
	err = db.QueryRow(ctx, `
		INSERT INTO schools (code, name, status)
		VALUES ('SCH-AI-TEST-01', 'مدرسة اختبار الذكاء الاصطناعي', 'active')
		ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
		RETURNING id::text
	`).Scan(&schoolID)
	if err != nil {
		t.Fatalf("insert test school: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ai_school_quotas WHERE school_id = $1::uuid`, schoolID)
		_, _ = db.Exec(context.Background(), `DELETE FROM schools WHERE id = $1::uuid`, schoolID)
		_, _ = db.Exec(context.Background(), `DELETE FROM audit_logs WHERE actor_user_id = $1::uuid`, actorID)
		_, _ = db.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, actorID)
	})

	// 1. Circuit breaker reset clears open_until & consecutive_failures
	openUntil := time.Now().UTC().Add(5 * time.Minute)
	if err = repo.RecordProviderFailure(ctx, ai.ProviderGemini, "timeout", &openUntil, time.Now().UTC()); err != nil {
		t.Fatalf("record failure: %v", err)
	}
	providers, err := repo.ResetCircuitBreakers(ctx, actorID)
	if err != nil {
		t.Fatalf("reset circuit breakers: %v", err)
	}
	for _, p := range providers {
		if p.Provider == ai.ProviderGemini {
			if p.Health.ConsecutiveFailures != 0 || p.Health.OpenUntil != nil || p.Health.LastError != "" {
				t.Fatalf("expected gemini health cleared, got %+v", p.Health)
			}
		}
	}

	// 2. School quota update & reset persist in PostgreSQL
	updated, err := repo.UpdateSchoolQuota(ctx, actorID, schoolID, ai.SchoolQuotaWrite{
		Tier:              "enterprise",
		TokenLimit:        500000,
		PDFExamLimit:      250,
		VoiceMinutesLimit: 300,
		WhiteboardEnabled: true,
	})
	if err != nil {
		t.Fatalf("update school quota: %v", err)
	}
	if updated.Tier != "enterprise" || updated.TokenLimit != 500000 || !updated.WhiteboardEnabled {
		t.Fatalf("unexpected updated school quota: %+v", updated)
	}

	if _, err = db.Exec(ctx, `
		UPDATE ai_school_quotas SET tokens_used = 12345, pdf_exams_used = 7, voice_minutes_used = 19 WHERE school_id = $1::uuid
	`, schoolID); err != nil {
		t.Fatalf("seed usage: %v", err)
	}

	reset, err := repo.ResetSchoolQuota(ctx, actorID, schoolID)
	if err != nil {
		t.Fatalf("reset school quota: %v", err)
	}
	if reset.TokensUsed != 0 || reset.PDFExamsUsed != 0 || reset.VoiceMinutesUsed != 0 || reset.LastResetAt == nil {
		t.Fatalf("expected zeroed usage after reset, got %+v", reset)
	}

	quotas, err := repo.ListSchoolQuotas(ctx)
	if err != nil {
		t.Fatalf("list school quotas: %v", err)
	}
	found := false
	for _, q := range quotas {
		if q.ID == schoolID && q.Tier == "enterprise" && q.TokensUsed == 0 {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected school %s in ListSchoolQuotas", schoolID)
	}

	// Unknown school returns ErrNotFound
	if _, err = repo.ResetSchoolQuota(ctx, actorID, "00000000-0000-0000-0000-000000000000"); !errors.Is(err, ai.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for unknown school, got %v", err)
	}
}
