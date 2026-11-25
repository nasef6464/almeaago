package postgres

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func openOpsTestDB(t *testing.T) *pgxpool.Pool {
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

func TestPlatformIntegrationsAndBackupsPostgres(t *testing.T) {
	db := openOpsTestDB(t)
	ctx := context.Background()
	repo := NewRepository(db, nil, NewAuditWriter())

	// Seed a temporary admin user so audit_logs FK/join works
	var actorID string
	_, _ = db.Exec(ctx, `DELETE FROM users WHERE lower(email) = 'ops-test-admin@example.test'`)
	err := db.QueryRow(ctx, `
		INSERT INTO users (email, name, status)
		VALUES ('ops-test-admin@example.test', 'Ops Admin', 'active')
		RETURNING id::text
	`).Scan(&actorID)
	if err != nil {
		t.Fatalf("insert test user: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM audit_logs WHERE actor_user_id = $1::uuid`, actorID)
		_, _ = db.Exec(context.Background(), `DELETE FROM operations_backup_exports WHERE created_by = $1::uuid`, actorID)
		_, _ = db.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, actorID)
	})

	// 1. Read & Update integrations + verify sync to content_platform_contact_settings + optimistic conflict
	initial, err := repo.GetIntegrationSettings(ctx)
	if err != nil {
		t.Fatalf("get integrations: %v", err)
	}
	next := initial.Settings
	next.ContactWidget.WhatsAppNumber = "+966599998888"
	next.SEO.GoogleTagManagerId = "GTM-TEST123"
	next.Auth.DefaultRole = "parent"

	updated, err := repo.UpdateIntegrationSettings(ctx, actorID, next, initial.Revision)
	if err != nil {
		t.Fatalf("update integrations: %v", err)
	}
	if updated.Revision != initial.Revision+1 {
		t.Fatalf("expected revision %d, got %d", initial.Revision+1, updated.Revision)
	}

	// Verify stale revision returns ErrConflict
	if _, err = repo.UpdateIntegrationSettings(ctx, actorID, next, initial.Revision); !errors.Is(err, operations.ErrConflict) {
		t.Fatalf("expected ErrConflict on stale revision, got %v", err)
	}

	// Verify content_platform_contact_settings was synced atomically
	var syncedPhone string
	if err = db.QueryRow(ctx, `SELECT settings->>'whatsappNumber' FROM content_platform_contact_settings WHERE key='default'`).Scan(&syncedPhone); err != nil {
		t.Fatalf("query synced contact settings: %v", err)
	}
	if syncedPhone != "+966599998888" {
		t.Fatalf("expected synced whatsappNumber '+966599998888', got %q", syncedPhone)
	}

	// Reload from DB
	reloaded, err := repo.GetIntegrationSettings(ctx)
	if err != nil {
		t.Fatalf("reload integrations: %v", err)
	}
	if reloaded.Settings.SEO.GoogleTagManagerId != "GTM-TEST123" || reloaded.Settings.Auth.DefaultRole != "parent" {
		t.Fatalf("reloaded settings mismatch: %+v", reloaded.Settings)
	}

	// Restore original integration settings
	_, _ = repo.UpdateIntegrationSettings(ctx, actorID, initial.Settings, updated.Revision)

	// 2. Backup Export covers all 10 collections and persists in operations_backup_exports
	exp, err := repo.CreateBackupExport(ctx, actorID, "ops-test-admin@example.test")
	if err != nil {
		t.Fatalf("create backup export: %v", err)
	}
	if exp.Payload.Kind != "almeaa-platform-backup" || len(exp.Payload.Summary) != 10 || len(exp.Payload.Collections) != 10 {
		t.Fatalf("expected 10 collections in backup payload, got summary=%v", exp.Payload.Summary)
	}
	for _, key := range []string{"paths", "levels", "subjects", "skills", "courses", "lessons", "questions", "quizzes", "library", "schools"} {
		if _, ok := exp.Payload.Collections[key]; !ok {
			t.Fatalf("missing collection %q in backup payload", key)
		}
	}
	history, err := repo.ListBackupExports(ctx, 50)
	if err != nil {
		t.Fatalf("list backup exports: %v", err)
	}
	found := false
	for _, item := range history {
		if item.ID == exp.ExportRecord.ID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected export %s in history", exp.ExportRecord.ID)
	}
}
