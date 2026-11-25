package postgres

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestListSchoolsIncludesRealStatsPostgres(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	repo := New(db, operationspg.NewAuditWriter())

	var actorID, studentID, teacherID, schoolID, classID string
	_, _ = db.Exec(ctx, `DELETE FROM users WHERE lower(email) IN ('stats-admin@example.test','stats-student@example.test','stats-teacher@example.test')`)
	if err = db.QueryRow(ctx, `INSERT INTO users (email, name, status) VALUES ('stats-admin@example.test', 'Stats Admin', 'active') RETURNING id::text`).Scan(&actorID); err != nil {
		t.Fatalf("insert actor: %v", err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO users (email, name, status) VALUES ('stats-student@example.test', 'Stats Student', 'active') RETURNING id::text`).Scan(&studentID); err != nil {
		t.Fatalf("insert student: %v", err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO users (email, name, status) VALUES ('stats-teacher@example.test', 'Stats Teacher', 'active') RETURNING id::text`).Scan(&teacherID); err != nil {
		t.Fatalf("insert teacher: %v", err)
	}
	if err = db.QueryRow(ctx, `
		INSERT INTO schools (code, name, status)
		VALUES ('SCH-STATS-PG-01', 'مدرسة إحصائيات حقيقية', 'active')
		ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
		RETURNING id::text
	`).Scan(&schoolID); err != nil {
		t.Fatalf("insert school: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM school_contracts WHERE school_id = $1::uuid`, schoolID)
		_, _ = db.Exec(context.Background(), `DELETE FROM school_memberships WHERE school_id = $1::uuid`, schoolID)
		_, _ = db.Exec(context.Background(), `DELETE FROM classes WHERE school_id = $1::uuid`, schoolID)
		_, _ = db.Exec(context.Background(), `DELETE FROM schools WHERE id = $1::uuid`, schoolID)
		_, _ = db.Exec(context.Background(), `DELETE FROM audit_logs WHERE actor_user_id = $1::uuid`, actorID)
		_, _ = db.Exec(context.Background(), `DELETE FROM users WHERE id IN ($1::uuid, $2::uuid, $3::uuid)`, actorID, studentID, teacherID)
	})

	if err = db.QueryRow(ctx, `
		INSERT INTO classes (school_id, code, name, status)
		VALUES ($1::uuid, 'CLS-STATS-1', 'فصل أول', 'active')
		RETURNING id::text
	`, schoolID).Scan(&classID); err != nil {
		t.Fatalf("insert class: %v", err)
	}
	if _, err = db.Exec(ctx, `
		INSERT INTO school_memberships (school_id, user_id, role, status)
		VALUES ($1::uuid, $2::uuid, 'student', 'active'), ($1::uuid, $3::uuid, 'teacher', 'active')
	`, schoolID, studentID, teacherID); err != nil {
		t.Fatalf("insert memberships: %v", err)
	}
	if _, err = db.Exec(ctx, `
		INSERT INTO school_contracts (school_id, status)
		VALUES ($1::uuid, 'active')
	`, schoolID); err != nil {
		t.Fatalf("insert contract: %v", err)
	}

	page, err := repo.ListSchools(ctx, org.AccessContext{
		ActorUserID: actorID,
		ActorRoles:  []identity.Role{identity.RoleAdmin},
	}, org.SchoolListQuery{Page: 1, Limit: 50, Search: "SCH-STATS-PG-01"})
	if err != nil {
		t.Fatalf("list schools: %v", err)
	}
	if len(page.Schools) != 1 {
		t.Fatalf("expected 1 school, got %d", len(page.Schools))
	}
	got := page.Schools[0].Stats
	if got.ClassesCount != 1 || got.StudentsCount != 1 || got.TeachersCount != 1 || got.ContractStatus != "active" {
		t.Fatalf("unexpected real stats: %+v", got)
	}
}
