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

type SeedUser struct {
	ID       string
	Email    string
	Name     string
	Phone    string
	Role     string
	Password string
}

func main() {
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		// Try loading from .env
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
		log.Fatal("DATABASE_URL is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("ping database: %v", err)
	}
	fmt.Println("Connected to database successfully.")

	// Hash password
	defaultPassword := "Almeaa@2026"
	passwordHash, err := security.HashPassword(defaultPassword)
	if err != nil {
		log.Fatalf("hash password: %v", err)
	}

	users := []SeedUser{
		{
			ID:       "018f0000-0000-7000-8000-000000000001",
			Email:    "admin@almeaa.com",
			Name:     "مدير المنصة العام",
			Phone:    "966500000001",
			Role:     "admin",
			Password: defaultPassword,
		},
		{
			ID:       "018f0000-0000-7000-8000-000000000002",
			Email:    "director@almeaa.com",
			Name:     "أ. عبدالله الشمري - مدير المدرسة",
			Phone:    "966500000002",
			Role:     "school_admin",
			Password: defaultPassword,
		},
		{
			ID:       "018f0000-0000-7000-8000-000000000003",
			Email:    "supervisor@almeaa.com",
			Name:     "د. خالد العتيبي - المشرف الأكاديمي",
			Phone:    "966500000003",
			Role:     "supervisor",
			Password: defaultPassword,
		},
		{
			ID:       "018f0000-0000-7000-8000-000000000004",
			Email:    "teacher@almeaa.com",
			Name:     "أ. فهد القحطاني - معلم القدرات",
			Phone:    "966500000004",
			Role:     "teacher",
			Password: defaultPassword,
		},
		{
			ID:       "018f0000-0000-7000-8000-000000000005",
			Email:    "student@almeaa.com",
			Name:     "فيصل بن سعد - طالب ثانوي",
			Phone:    "966500000005",
			Role:     "student",
			Password: defaultPassword,
		},
		{
			ID:       "018f0000-0000-7000-8000-000000000006",
			Email:    "parent@almeaa.com",
			Name:     "سعد بن ناصر - ولي أمر",
			Phone:    "966500000006",
			Role:     "parent",
			Password: defaultPassword,
		},
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Fatalf("begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, u := range users {
		// Upsert user
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
			log.Fatalf("upsert user %s: %v", u.Email, err)
		}

		// Upsert user_roles
		_, err = tx.Exec(ctx, `
			INSERT INTO user_roles (user_id, role, created_at)
			VALUES ($1::uuid, $2, now())
			ON CONFLICT (user_id, role) DO NOTHING
		`, u.ID, u.Role)
		if err != nil {
			log.Fatalf("upsert role %s for %s: %v", u.Role, u.Email, err)
		}

		fmt.Printf("Seeded user: %s (%s) - Password: %s\n", u.Email, u.Role, u.Password)
	}

	// Create default school
	schoolID := "018f0000-0000-7000-9000-000000000001"
	_, err = tx.Exec(ctx, `
		INSERT INTO schools (id, code, name, status, created_at, updated_at)
		VALUES ($1::uuid, 'SCH-ALMEAA-01', 'مدارس المئة النموذجية الأهلية', 'active', now(), now())
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active'
	`, schoolID)
	if err != nil {
		log.Fatalf("upsert school: %v", err)
	}

	// Link director to school
	_, err = tx.Exec(ctx, `
		INSERT INTO school_memberships (id, school_id, user_id, role, status, created_at, updated_at)
		VALUES (uuidv7(), $1::uuid, '018f0000-0000-7000-8000-000000000002'::uuid, 'school_admin', 'active', now(), now())
		ON CONFLICT (school_id, user_id, role) DO UPDATE SET status = 'active'
	`, schoolID)
	if err != nil {
		log.Printf("school_membership director: %v", err)
	}

	// Link supervisor to school
	_, err = tx.Exec(ctx, `
		INSERT INTO school_memberships (id, school_id, user_id, role, status, created_at, updated_at)
		VALUES (uuidv7(), $1::uuid, '018f0000-0000-7000-8000-000000000003'::uuid, 'supervisor', 'active', now(), now())
		ON CONFLICT (school_id, user_id, role) DO UPDATE SET status = 'active'
	`, schoolID)
	if err != nil {
		log.Printf("school_membership supervisor: %v", err)
	}

	// Link teacher to school
	_, err = tx.Exec(ctx, `
		INSERT INTO school_memberships (id, school_id, user_id, role, status, created_at, updated_at)
		VALUES (uuidv7(), $1::uuid, '018f0000-0000-7000-8000-000000000004'::uuid, 'teacher', 'active', now(), now())
		ON CONFLICT (school_id, user_id, role) DO UPDATE SET status = 'active'
	`, schoolID)
	if err != nil {
		log.Printf("school_membership teacher: %v", err)
	}

	// Link student to school
	_, err = tx.Exec(ctx, `
		INSERT INTO school_memberships (id, school_id, user_id, role, status, created_at, updated_at)
		VALUES (uuidv7(), $1::uuid, '018f0000-0000-7000-8000-000000000005'::uuid, 'student', 'active', now(), now())
		ON CONFLICT (school_id, user_id, role) DO UPDATE SET status = 'active'
	`, schoolID)
	if err != nil {
		log.Printf("school_membership student: %v", err)
	}

	// Link parent to student
	_, err = tx.Exec(ctx, `
		INSERT INTO parent_student_relationships (id, parent_user_id, student_user_id, school_id, status, source, created_at, updated_at)
		VALUES (uuidv7(), '018f0000-0000-7000-8000-000000000006'::uuid, '018f0000-0000-7000-8000-000000000005'::uuid, $1::uuid, 'active', 'admin', now(), now())
		ON CONFLICT (id) DO NOTHING
	`, schoolID)
	if err != nil {
		log.Printf("parent_student_relationship: %v", err)
	}

	// Seed core taxonomy if not present
	qudratPathID := "018f0000-0000-7000-a000-000000000001"
	_, err = tx.Exec(ctx, `
		INSERT INTO paths (id, code, name, description, status, sort_order, presentation, created_at, updated_at)
		VALUES ($1::uuid, 'qudrat', 'مسار القدرات العامة', 'تأسيس وتدريب شامل لاختبار القدرات العامة (كمي ولفظي)', 'active', 1, '{"showInNavbar": true, "showInHome": true}'::jsonb, now(), now())
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active'
	`, qudratPathID)
	if err != nil {
		log.Printf("seed qudrat path: %v", err)
	}

	tahsiliPathID := "018f0000-0000-7000-a000-000000000002"
	_, err = tx.Exec(ctx, `
		INSERT INTO paths (id, code, name, description, status, sort_order, presentation, created_at, updated_at)
		VALUES ($1::uuid, 'tahsili', 'مسار التحصيلي العلمي', 'تأسيس واختبارات محاكية لاختبار التحصيلي لطلاب العلمي', 'active', 2, '{"showInNavbar": true, "showInHome": true}'::jsonb, now(), now())
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active'
	`, tahsiliPathID)
	if err != nil {
		log.Printf("seed tahsili path: %v", err)
	}

	// Commit
	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("commit tx: %v", err)
	}

	fmt.Println("\nAll standard production accounts and core taxonomy seeded successfully!")
}
