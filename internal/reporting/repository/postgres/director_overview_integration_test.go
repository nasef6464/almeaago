package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DATABASE_URL is supplied by Database CI. Isolated tables prevent test data
// from affecting the migrated public schema or other tests.
func TestDirectorOverviewCountsRealSchoolAudiencePostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close(context.Background())
	schema := fmt.Sprintf("director_overview_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, sql := range []string{
		`CREATE TABLE schools(id uuid PRIMARY KEY, name text NOT NULL, status text NOT NULL)`,
		`CREATE TABLE classes(id uuid PRIMARY KEY, school_id uuid NOT NULL, name text NOT NULL, status text NOT NULL)`,
		`CREATE TABLE school_memberships(school_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL, status text NOT NULL)`,
		`CREATE TABLE teaching_assignments(school_id uuid NOT NULL, teacher_id uuid NOT NULL, class_id uuid NOT NULL, status text NOT NULL)`,
		`CREATE TABLE school_supervisor_scopes(school_id uuid NOT NULL, supervisor_user_id uuid NOT NULL, status text NOT NULL)`,
		`CREATE TABLE classroom_sessions(school_id uuid NOT NULL, status text NOT NULL)`,
		`CREATE TABLE assessments(id uuid PRIMARY KEY, owner_school_id uuid, is_published boolean NOT NULL)`,
		`CREATE TABLE assessment_assignments(id uuid PRIMARY KEY, assessment_id uuid NOT NULL, school_id uuid, status text NOT NULL)`,
		`CREATE TABLE assessment_assignment_classes(assignment_id uuid NOT NULL, class_id uuid NOT NULL)`,
		`CREATE TABLE assessment_assignment_users(assignment_id uuid NOT NULL, user_id uuid NOT NULL)`,
	} {
		if _, err := db.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}

	const schoolA = "00000000-0000-0000-0000-000000000101"
	const schoolB = "00000000-0000-0000-0000-000000000102"
	const classA = "00000000-0000-0000-0000-000000000201"
	const classB = "00000000-0000-0000-0000-000000000202"
	const otherClass = "00000000-0000-0000-0000-000000000203"
	const studentA = "00000000-0000-0000-0000-000000000301"
	const studentSuspended = "00000000-0000-0000-0000-000000000302"
	const studentOther = "00000000-0000-0000-0000-000000000303"
	const teacher = "00000000-0000-0000-0000-000000000401"
	const supervisorSchool = "00000000-0000-0000-0000-000000000501"
	const supervisorClass = "00000000-0000-0000-0000-000000000502"

	fixtures := []string{
		`INSERT INTO schools VALUES ('` + schoolA + `','مدرسة المئة','active'),('` + schoolB + `','مدرسة أخرى','active')`,
		`INSERT INTO classes VALUES ('` + classA + `','` + schoolA + `','الأول أ','active'),('` + classB + `','` + schoolA + `','الأول ب','active'),('` + otherClass + `','` + schoolB + `','الثاني أ','active')`,
		`INSERT INTO school_memberships VALUES ('` + schoolA + `','` + studentA + `','student','active'),('` + schoolA + `','` + studentSuspended + `','student','suspended'),('` + schoolB + `','` + studentOther + `','student','active')`,
		`INSERT INTO teaching_assignments VALUES ('` + schoolA + `','` + teacher + `','` + classA + `','active'),('` + schoolA + `','` + teacher + `','` + classB + `','active'),('` + schoolB + `','` + teacher + `','` + otherClass + `','active')`,
		`INSERT INTO school_supervisor_scopes VALUES ('` + schoolA + `','` + supervisorSchool + `','active'),('` + schoolA + `','` + supervisorSchool + `','active'),('` + schoolA + `','` + supervisorClass + `','active'),('` + schoolB + `','` + supervisorClass + `','active')`,
		`INSERT INTO classroom_sessions VALUES ('` + schoolA + `','ended'),('` + schoolA + `','archived'),('` + schoolB + `','ended')`,
		`INSERT INTO assessments VALUES ('00000000-0000-0000-0000-000000000601',NULL,true),('00000000-0000-0000-0000-000000000602','` + schoolB + `',true),('00000000-0000-0000-0000-000000000603','` + schoolA + `',false),('00000000-0000-0000-0000-000000000604','` + schoolB + `',true)`,
		`INSERT INTO assessment_assignments VALUES ('00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000601','` + schoolA + `','active'),('00000000-0000-0000-0000-000000000702','00000000-0000-0000-0000-000000000602','` + schoolA + `','active'),('00000000-0000-0000-0000-000000000703','00000000-0000-0000-0000-000000000603','` + schoolA + `','active'),('00000000-0000-0000-0000-000000000704','00000000-0000-0000-0000-000000000604','` + schoolB + `','active')`,
		`INSERT INTO assessment_assignment_classes VALUES ('00000000-0000-0000-0000-000000000701','` + classA + `'),('00000000-0000-0000-0000-000000000701','` + classB + `'),('00000000-0000-0000-0000-000000000703','` + classA + `'),('00000000-0000-0000-0000-000000000704','` + otherClass + `')`,
		`INSERT INTO assessment_assignment_users VALUES ('00000000-0000-0000-0000-000000000702','` + studentA + `')`,
	}
	for _, sql := range fixtures {
		if _, err := db.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}

	directory := NewSchoolDirectorDirectory(db)
	overview, err := directory.DirectorOverview(ctx, schoolA)
	if err != nil {
		t.Fatal(err)
	}
	if overview.School.SchoolID != schoolA || overview.School.SchoolName != "مدرسة المئة" {
		t.Fatalf("wrong school: %+v", overview.School)
	}
	if overview.Metrics.Students != 2 || overview.Metrics.Classes != 2 || overview.Metrics.Teachers != 1 || overview.Metrics.Supervisors != 2 || overview.Metrics.SchoolAssessments != 2 || overview.Metrics.CompletedSmartClasses != 1 {
		t.Fatalf("wrong school counters: %+v", overview.Metrics)
	}
	if len(overview.Classes) != 2 || overview.Classes[0].ClassName != "الأول أ" || overview.Classes[1].ClassName != "الأول ب" {
		t.Fatalf("wrong scoped classrooms: %+v", overview.Classes)
	}

	other, err := directory.DirectorOverview(ctx, schoolB)
	if err != nil {
		t.Fatal(err)
	}
	if other.Metrics.Students != 1 || other.Metrics.Classes != 1 || other.Metrics.Teachers != 1 || other.Metrics.Supervisors != 1 || other.Metrics.SchoolAssessments != 1 || other.Metrics.CompletedSmartClasses != 1 {
		t.Fatalf("cross-school leak or wrong school B counters: %+v", other.Metrics)
	}
}
