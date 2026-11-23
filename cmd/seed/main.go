package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nasef6464/almeaago/internal/platform/security"
)

// productionHostPatterns are substrings that identify a production database URL.
// The seed tool must NEVER run against these without an explicit opt-in.
var productionHostPatterns = []string{
	"br-damp-feather-b9lqdru1", // Neon production branch
	"neon.tech",                // Any Neon host (covers all branches unless local)
}

// safeHostAllowList are substrings that identify explicitly safe (non-production) hosts.
// A URL is considered safe only when it matches at least one of these.
var safeHostAllowList = []string{
	"localhost",
	"127.0.0.1",
	"@postgres", // docker-compose service name
	"@db:",      // common compose alias
	"test",      // e.g. almeaa_test, test_db
	"-preview",  // Neon preview branch
	"-staging",  // staging branch
	"-dev",      // dev branch
}

type SeedUser struct {
	ID    string
	Email string
	Name  string
	Phone string
	Role  string
}

func main() {
	// ── Safety gate 1: explicit opt-in required ────────────────────────────
	if os.Getenv("ALLOW_SEED") != "true" {
		log.Fatal(
			"[seed] BLOCKED: ALLOW_SEED=true is not set.\n" +
				"This tool writes to the database. Set ALLOW_SEED=true only on a " +
				"disposable local or test database. Never set it on production.",
		)
	}

	// ── Load DATABASE_URL ──────────────────────────────────────────────────
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		data, err := os.ReadFile(".env")
		if err == nil {
			for _, line := range strings.Split(string(data), "\n") {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "DATABASE_URL=") {
					val := strings.TrimPrefix(line, "DATABASE_URL=")
					databaseURL = strings.Trim(val, `"' `)
					break
				}
			}
		}
	}

	if databaseURL == "" {
		log.Fatal("[seed] BLOCKED: DATABASE_URL is required")
	}

	// ── Safety gate 2: reject production database URLs ─────────────────────
	lowerURL := strings.ToLower(databaseURL)

	isProd := false
	for _, pattern := range productionHostPatterns {
		if strings.Contains(lowerURL, strings.ToLower(pattern)) {
			isProd = true
			break
		}
	}

	isSafe := false
	for _, allow := range safeHostAllowList {
		if strings.Contains(lowerURL, strings.ToLower(allow)) {
			isSafe = true
			break
		}
	}

	if isProd && !isSafe {
		log.Fatal(
			"[seed] BLOCKED: DATABASE_URL appears to target a production database.\n" +
				"Seed is only allowed against localhost, test, preview, staging, or dev databases.\n" +
				"Refusing to run to protect production data.",
		)
	}

	// Log a sanitized URL (host+dbname only, no credentials)
	sanitized := sanitizeURL(databaseURL)
	fmt.Printf("[seed] Target database (sanitized): %s\n", sanitized)

	// ── Connect ────────────────────────────────────────────────────────────
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("[seed] connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("[seed] ping database: %v", err)
	}
	fmt.Println("[seed] Connected to database successfully.")

	// ── Hash password ──────────────────────────────────────────────────────
	// NOTE: defaultPassword is NEVER printed to stdout/stderr.
	defaultPassword := "Almeaa@2026"
	passwordHash, err := security.HashPassword(defaultPassword)
	if err != nil {
		log.Fatalf("[seed] hash password: %v", err)
	}

	users := []SeedUser{
		{
			ID:    "018f0000-0000-7000-8000-000000000001",
			Email: "admin@almeaa.com",
			Name:  "مدير المنصة العام",
			Phone: "966500000001",
			Role:  "admin",
		},
		{
			ID:    "018f0000-0000-7000-8000-000000000002",
			Email: "director@almeaa.com",
			Name:  "أ. عبدالله الشمري - مدير المدرسة",
			Phone: "966500000002",
			Role:  "school_admin",
		},
		{
			ID:    "018f0000-0000-7000-8000-000000000003",
			Email: "supervisor@almeaa.com",
			Name:  "د. خالد العتيبي - المشرف الأكاديمي",
			Phone: "966500000003",
			Role:  "supervisor",
		},
		{
			ID:    "018f0000-0000-7000-8000-000000000004",
			Email: "teacher@almeaa.com",
			Name:  "أ. فهد القحطاني - معلم القدرات",
			Phone: "966500000004",
			Role:  "teacher",
		},
		{
			ID:    "018f0000-0000-7000-8000-000000000005",
			Email: "student@almeaa.com",
			Name:  "فيصل بن سعد - طالب ثانوي",
			Phone: "966500000005",
			Role:  "student",
		},
		{
			ID:    "018f0000-0000-7000-8000-000000000006",
			Email: "parent@almeaa.com",
			Name:  "سعد بن ناصر - ولي أمر",
			Phone: "966500000006",
			Role:  "parent",
		},
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Fatalf("[seed] begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, u := range users {
		_, err := tx.Exec(ctx, `
			INSERT INTO users (id, email, name, phone, password_hash, status, email_verified_at, created_at, updated_at)
			VALUES ($1::uuid, $2, $3, $4, $5, 'active', now(), now(), now())
			ON CONFLICT (lower(email)) WHERE email IS NOT NULL AND btrim(email) <> '' DO UPDATE SET
				name = EXCLUDED.name,
				phone = EXCLUDED.phone,
				password_hash = EXCLUDED.password_hash,
				status = 'active',
				updated_at = now()
		`, u.ID, u.Email, u.Name, u.Phone, passwordHash)
		if err != nil {
			log.Fatalf("[seed] upsert user %s: %v", u.Email, err)
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO user_roles (user_id, role, created_at)
			VALUES ($1::uuid, $2, now())
			ON CONFLICT (user_id, role) DO NOTHING
		`, u.ID, u.Role)
		if err != nil {
			log.Fatalf("[seed] upsert role %s for %s: %v", u.Role, u.Email, err)
		}

		// Log email and role ONLY — never log the password
		fmt.Printf("[seed] Seeded user: %s (%s)\n", u.Email, u.Role)
	}

	// Create default school
	schoolID := "018f0000-0000-7000-9000-000000000001"
	_, err = tx.Exec(ctx, `
		INSERT INTO schools (id, code, name, status, created_at, updated_at)
		VALUES ($1::uuid, 'SCH-ALMEAA-01', 'مدارس المئة النموذجية الأهلية', 'active', now(), now())
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active'
	`, schoolID)
	if err != nil {
		log.Fatalf("[seed] upsert school: %v", err)
	}

	// Link members to school
	memberships := []struct {
		userID string
		role   string
	}{
		{"018f0000-0000-7000-8000-000000000002", "school_admin"},
		{"018f0000-0000-7000-8000-000000000003", "supervisor"},
		{"018f0000-0000-7000-8000-000000000004", "teacher"},
		{"018f0000-0000-7000-8000-000000000005", "student"},
	}
	for _, m := range memberships {
		_, err = tx.Exec(ctx, `
			INSERT INTO school_memberships (id, school_id, user_id, role, status, created_at, updated_at)
			VALUES (uuidv7(), $1::uuid, $2::uuid, $3, 'active', now(), now())
			ON CONFLICT (school_id, user_id, role) DO UPDATE SET status = 'active'
		`, schoolID, m.userID, m.role)
		if err != nil {
			log.Printf("[seed] school_membership %s: %v", m.role, err)
		}
	}

	// Link parent → student
	_, err = tx.Exec(ctx, `
		INSERT INTO parent_student_relationships (id, parent_user_id, student_user_id, school_id, status, source, created_at, updated_at)
		VALUES (uuidv7(), '018f0000-0000-7000-8000-000000000006'::uuid, '018f0000-0000-7000-8000-000000000005'::uuid, $1::uuid, 'active', 'admin', now(), now())
		ON CONFLICT (id) DO NOTHING
	`, schoolID)
	if err != nil {
		log.Printf("[seed] parent_student_relationship: %v", err)
	}

	// Seed core taxonomy
	qudratPathID := "018f0000-0000-7000-a000-000000000001"
	_, err = tx.Exec(ctx, `
		INSERT INTO paths (id, code, name, description, status, sort_order, presentation, created_at, updated_at)
		VALUES ($1::uuid, 'qudrat', 'مسار القدرات العامة', 'تأسيس وتدريب شامل لاختبار القدرات العامة (كمي ولفظي)', 'active', 1, '{"showInNavbar": true, "showInHome": true}'::jsonb, now(), now())
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active'
	`, qudratPathID)
	if err != nil {
		log.Printf("[seed] seed qudrat path: %v", err)
	}

	tahsiliPathID := "018f0000-0000-7000-a000-000000000002"
	_, err = tx.Exec(ctx, `
		INSERT INTO paths (id, code, name, description, status, sort_order, presentation, created_at, updated_at)
		VALUES ($1::uuid, 'tahsili', 'مسار التحصيلي العلمي', 'تأسيس واختبارات محاكية لاختبار التحصيلي لطلاب العلمي', 'active', 2, '{"showInNavbar": true, "showInHome": true}'::jsonb, now(), now())
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active'
	`, tahsiliPathID)
	if err != nil {
		log.Printf("[seed] seed tahsili path: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("[seed] commit tx: %v", err)
	}

	fmt.Println("\n[seed] All standard test accounts and core taxonomy seeded successfully!")
	fmt.Println("[seed] REMINDER: This was run against a non-production database only.")
}

// sanitizeURL removes credentials from a database URL for safe logging.
// Input:  postgres://user:password@host:5432/dbname?sslmode=require
// Output: postgres://***:***@host:5432/dbname
func sanitizeURL(raw string) string {
	// Find the scheme separator
	schemeEnd := strings.Index(raw, "://")
	if schemeEnd < 0 {
		return "[unparseable URL]"
	}
	scheme := raw[:schemeEnd]
	rest := raw[schemeEnd+3:]

	// Find the @ separating credentials from host
	atIdx := strings.LastIndex(rest, "@")
	if atIdx < 0 {
		// No credentials in URL
		return scheme + "://" + rest
	}
	hostAndDB := rest[atIdx+1:]
	// Strip query string from hostAndDB for clean output
	if qi := strings.Index(hostAndDB, "?"); qi >= 0 {
		hostAndDB = hostAndDB[:qi]
	}
	return scheme + "://***:***@" + hostAndDB
}
