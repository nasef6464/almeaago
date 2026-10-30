package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

// A single-connection temporary table shadows the migrated public table.
// The test does not read or write real learner plans.
func TestStudyPlanListScopePostgres(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	config.MaxConns = 1
	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(ctx, `CREATE TEMP TABLE study_plans AS SELECT * FROM public.study_plans WITH NO DATA`); err != nil {
		t.Fatal(err)
	}
	const student = "00000000-0000-0000-0000-000000000001"
	const otherStudent = "00000000-0000-0000-0000-000000000002"
	const pathID = "00000000-0000-0000-0000-000000000003"
	const otherPath = "00000000-0000-0000-0000-000000000004"
	rows := []struct {
		id, owner, path, status string
	}{
		{"00000000-0000-0000-0000-000000000011", student, pathID, "active"},
		{"00000000-0000-0000-0000-000000000012", student, pathID, "archived"},
		{"00000000-0000-0000-0000-000000000013", student, otherPath, "active"},
		{"00000000-0000-0000-0000-000000000014", otherStudent, pathID, "active"},
	}
	for _, row := range rows {
		if _, err := db.Exec(ctx, `INSERT INTO pg_temp.study_plans
			(id,student_id,name,path_id,start_date,end_date,skip_completed_assessments,
			 daily_minutes,preferred_start_time,status,created_at,updated_at)
			VALUES ($1::uuid,$2::uuid,'خطة اختبار',$3::uuid,'2026-10-29','2026-11-05',
			        true,90,'17:00',$4,now(),now())`,
			row.id, row.owner, row.path, row.status); err != nil {
			t.Fatal(err)
		}
	}
	repo := New(db)
	for _, tc := range []struct {
		student, path string
		status        learning.StudyPlanStatus
		expected      string
	}{
		{student, pathID, learning.StudyPlanActive, rows[0].id},
		{student, pathID, learning.StudyPlanArchived, rows[1].id},
		{student, otherPath, learning.StudyPlanActive, rows[2].id},
		{otherStudent, pathID, learning.StudyPlanActive, rows[3].id},
	} {
		page, err := repo.ListStudyPlans(ctx, tc.student, tc.path, tc.status, 1, 20)
		if err != nil {
			t.Fatal(err)
		}
		if len(page.Items) != 1 || page.Items[0].ID != tc.expected || page.Items[0].Status != tc.status ||
			page.Items[0].PathID != tc.path || page.Items[0].StudentID != tc.student {
			t.Fatalf("scope leak for %s/%s/%s: %+v", tc.student, tc.path, tc.status, page.Items)
		}
	}
}
