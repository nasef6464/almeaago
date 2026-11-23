package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nasef6464/almeaago/internal/platform/security"
)

// ProhibitedRemoteHostSuffixes are remote and cloud database domains that must never be seeded.
var prohibitedRemoteHostSuffixes = []string{
	"neon.tech",
	"render.com",
	"amazonaws.com",
	"azure.com",
	"google.com",
	"supabase.co",
	"supabase.in",
	"cockroachlabs.cloud",
	"aivencloud.com",
}

// ProhibitedBranchPatterns are production-specific branch identifiers that must never appear in raw URLs.
var prohibitedBranchPatterns = []string{
	"br-damp-feather-b9lqdru1", // Neon production branch
}

// AuthorizedLocalHosts are the only hosts permitted to run database seed.
var authorizedLocalHosts = map[string]bool{
	"localhost":            true,
	"127.0.0.1":            true,
	"::1":                  true,
	"postgres":             true,
	"db":                   true,
	"host.docker.internal": true,
}

// ProhibitedEnvironments are APP_ENV values that strictly forbid database seeding.
var prohibitedEnvironments = map[string]bool{
	"production": true,
	"prod":       true,
	"live":       true,
	"stage":      true,
	"staging":    true,
}

// SafetyVerification holds verified connection attributes for safe logging.
type SafetyVerification struct {
	SanitizedURL string
	Host         string
	Port         int
	Database     string
}

// ValidateDatabaseURL performs strict in-memory validation of database connection settings.
// It enforces fail-closed security guards without opening network sockets:
// 1. ALLOW_SEED=true is required.
// 2. APP_ENV must not be production/staging.
// 3. DATABASE_URL must not contain production branch identifiers (e.g. br-damp-feather-b9lqdru1).
// 4. Host must be strictly parsed (URL / pgx DSN) and must belong to the authorized local whitelist (localhost, 127.0.0.1, postgres, db).
// 5. Cloud/remote database hosts (neon.tech, render.com, etc.) are unconditionally rejected,
//    regardless of any substrings (like "test") in the path, database name, user, or query string.
func ValidateDatabaseURL(databaseURL, appEnv, allowSeed string) (*SafetyVerification, error) {
	if strings.TrimSpace(allowSeed) != "true" {
		return nil, errors.New("ALLOW_SEED=true is not set. Seeding is only permitted on a disposable local test database")
	}

	normEnv := strings.ToLower(strings.TrimSpace(appEnv))
	if prohibitedEnvironments[normEnv] {
		return nil, fmt.Errorf("seeding is strictly prohibited in environment APP_ENV=%q", normEnv)
	}

	trimmedURL := strings.TrimSpace(databaseURL)
	if trimmedURL == "" {
		return nil, errors.New("DATABASE_URL is required")
	}

	lowerRaw := strings.ToLower(trimmedURL)
	for _, pattern := range prohibitedBranchPatterns {
		if strings.Contains(lowerRaw, strings.ToLower(pattern)) {
			return nil, fmt.Errorf("DATABASE_URL targets protected production branch pattern %q", pattern)
		}
	}

	// Parse host, port, and database using pgxpool and net/url
	var host string
	var port int
	var database string

	// Attempt parsing with pgxpool config first (handles postgres:// and DSN key=value formats)
	if cfg, err := pgxpool.ParseConfig(trimmedURL); err == nil && cfg != nil && cfg.ConnConfig != nil {
		host = strings.TrimSpace(cfg.ConnConfig.Host)
		port = int(cfg.ConnConfig.Port)
		database = strings.TrimSpace(cfg.ConnConfig.Database)
	}

	// Cross-check / fallback with net/url for postgres:// or postgresql:// schemes
	if parsedURL, err := url.Parse(trimmedURL); err == nil && parsedURL != nil && parsedURL.Host != "" {
		h := parsedURL.Hostname()
		if h != "" {
			host = h
		}
		if pStr := parsedURL.Port(); pStr != "" {
			if pInt, err := strconv.Atoi(pStr); err == nil && pInt > 0 {
				port = pInt
			}
		}
		if path := strings.TrimPrefix(parsedURL.Path, "/"); path != "" && database == "" {
			database = path
		}
	}

	host = strings.ToLower(strings.TrimSpace(host))
	if host == "" {
		return nil, errors.New("unable to resolve database hostname from DATABASE_URL")
	}

	// Rule: Host must not match any prohibited cloud/remote domains
	for _, remoteSuffix := range prohibitedRemoteHostSuffixes {
		if host == remoteSuffix || strings.HasSuffix(host, "."+remoteSuffix) || strings.Contains(host, remoteSuffix) {
			return nil, fmt.Errorf("remote or cloud database host %q is prohibited for seeding. Neon preview/production and cloud hosts are forbidden", host)
		}
	}

	// Rule: Host must be in the authorized local whitelist
	if !authorizedLocalHosts[host] {
		// Check for loopback IP addresses if numeric
		ip := net.ParseIP(host)
		if ip == nil || !ip.IsLoopback() {
			return nil, fmt.Errorf("database host %q is not an authorized local development host (allowed: localhost, 127.0.0.1, ::1, postgres, db)", host)
		}
	}

	if port <= 0 {
		port = 5432
	}
	if port > 65535 {
		return nil, fmt.Errorf("invalid database port %d", port)
	}

	sanitized := sanitizeURL(trimmedURL)
	return &SafetyVerification{
		SanitizedURL: sanitized,
		Host:         host,
		Port:         port,
		Database:     database,
	}, nil
}

type SeedUser struct {
	ID         string
	Email      string
	Name       string
	Phone      string
	Role       string
	ExtraRoles []string
}

func loadDatabaseURL() string {
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL != "" {
		return databaseURL
	}
	data, err := os.ReadFile(".env")
	if err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "DATABASE_URL=") {
				val := strings.TrimPrefix(line, "DATABASE_URL=")
				return strings.Trim(val, `"' `)
			}
		}
	}
	return ""
}

func main() {
	allowSeed := os.Getenv("ALLOW_SEED")
	appEnv := os.Getenv("APP_ENV")
	databaseURL := loadDatabaseURL()

	safety, err := ValidateDatabaseURL(databaseURL, appEnv, allowSeed)
	if err != nil {
		log.Fatalf("[seed] BLOCKED: %v", err)
	}

	fmt.Printf("[seed] Target database verified safe: %s (host=%s, port=%d, db=%s)\n",
		safety.SanitizedURL, safety.Host, safety.Port, safety.Database)

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
		{
			ID:         "018f0000-0000-7000-8000-000000000007",
			Email:      "coach@almeaa.com",
			Name:       "أ. طارق المحمدي - مدرب المنصة",
			Phone:      "966500000007",
			Role:       "platform_trainer",
			ExtraRoles: []string{"trainer", "teacher"},
		},
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Fatalf("[seed] begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, u := range users {
		// Only update password if user ID matches predefined standard test seed account ID
		_, err := tx.Exec(ctx, `
			INSERT INTO users (id, email, name, phone, password_hash, status, email_verified_at, created_at, updated_at)
			VALUES ($1::uuid, $2, $3, $4, $5, 'active', now(), now(), now())
			ON CONFLICT (lower(email)) WHERE email IS NOT NULL AND btrim(email) <> '' DO UPDATE SET
				name = EXCLUDED.name,
				phone = EXCLUDED.phone,
				password_hash = EXCLUDED.password_hash,
				status = 'active',
				updated_at = now()
			WHERE users.id = EXCLUDED.id
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

		for _, extra := range u.ExtraRoles {
			_, err = tx.Exec(ctx, `
				INSERT INTO user_roles (user_id, role, created_at)
				VALUES ($1::uuid, $2, now())
				ON CONFLICT (user_id, role) DO NOTHING
			`, u.ID, extra)
			if err != nil {
				log.Fatalf("[seed] upsert extra role %s for %s: %v", extra, u.Email, err)
			}
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
	if parsed, err := url.Parse(raw); err == nil && parsed.Scheme != "" {
		parsed.User = url.UserPassword("***", "***")
		parsed.RawQuery = ""
		return parsed.String()
	}

	schemeEnd := strings.Index(raw, "://")
	if schemeEnd < 0 {
		return "[unparseable URL]"
	}
	scheme := raw[:schemeEnd]
	rest := raw[schemeEnd+3:]
	atIdx := strings.LastIndex(rest, "@")
	if atIdx < 0 {
		return scheme + "://" + rest
	}
	hostAndDB := rest[atIdx+1:]
	if qi := strings.Index(hostAndDB, "?"); qi >= 0 {
		hostAndDB = hostAndDB[:qi]
	}
	return scheme + "://***:***@" + hostAndDB
}
