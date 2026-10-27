package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DATABASE_URL is supplied by Database CI after real migrations are applied.
// The fixture uses the actual migrated schema and rolls back all test rows.
func TestDirectorOverviewCountsRealSchoolAudiencePostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(context.Background())

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
	const pathID = "00000000-0000-0000-0000-000000000801"
	const subjectID = "00000000-0000-0000-0000-000000000802"

	fixtures := []string{
		`INSERT INTO users(id,email,name,password_hash) VALUES
		 ('` + studentA + `','director-overview-a@example.invalid','طالب أ','test-only'),
		 ('` + studentSuspended + `','director-overview-suspended@example.invalid','طالب موقوف','test-only'),
		 ('` + studentOther + `','director-overview-other@example.invalid','طالب ب','test-only'),
		 ('` + teacher + `','director-overview-teacher@example.invalid','معلم','test-only'),
		 ('` + supervisorSchool + `','director-overview-supervisor-school@example.invalid','مشرف مدرسة','test-only'),
		 ('` + supervisorClass + `','director-overview-supervisor-class@example.invalid','مشرف فصل','test-only')`,
		`INSERT INTO schools(id,code,name) VALUES ('` + schoolA + `','OVERVIEW-A','مدرسة المئة'),('` + schoolB + `','OVERVIEW-B','مدرسة أخرى')`,
		`INSERT INTO classes(id,school_id,code,name) VALUES ('` + classA + `','` + schoolA + `','A1','الأول أ'),('` + classB + `','` + schoolA + `','A2','الأول ب'),('` + otherClass + `','` + schoolB + `','B1','الثاني أ')`,
		`INSERT INTO paths(id,code,name) VALUES ('` + pathID + `','OVERVIEW-PATH','مسار الاختبار')`,
		`INSERT INTO subjects(id,path_id,code,name) VALUES ('` + subjectID + `','` + pathID + `','OVERVIEW-SUBJECT','الرياضيات')`,
		`INSERT INTO school_memberships(school_id,user_id,role,status) VALUES ('` + schoolA + `','` + studentA + `','student','active'),('` + schoolA + `','` + studentSuspended + `','student','suspended'),('` + schoolB + `','` + studentOther + `','student','active')`,
		`INSERT INTO teaching_assignments(school_id,teacher_id,class_id,subject_id,status) VALUES ('` + schoolA + `','` + teacher + `','` + classA + `','` + subjectID + `','active'),('` + schoolA + `','` + teacher + `','` + classB + `','` + subjectID + `','active'),('` + schoolB + `','` + teacher + `','` + otherClass + `','` + subjectID + `','active')`,
		`INSERT INTO school_supervisor_scopes(school_id,supervisor_user_id,scope_type,class_id,status) VALUES
		 ('` + schoolA + `','` + supervisorSchool + `','school',NULL,'active'),
		 ('` + schoolA + `','` + supervisorSchool + `','class','` + classA + `','active'),
		 ('` + schoolA + `','` + supervisorClass + `','class','` + classB + `','active'),
		 ('` + schoolB + `','` + supervisorClass + `','school',NULL,'active')`,
		`INSERT INTO classroom_sessions(school_id,class_id,subject_id,teacher_id,status,pin_hash,pin_expires_at,ended_at) VALUES
		 ('` + schoolA + `','` + classA + `','` + subjectID + `','` + teacher + `','ended',repeat('a',64),now()+interval '1 hour',now()),
		 ('` + schoolA + `','` + classB + `','` + subjectID + `','` + teacher + `','archived',repeat('b',64),now()+interval '1 hour',now()),
		 ('` + schoolB + `','` + otherClass + `','` + subjectID + `','` + teacher + `','ended',repeat('c',64),now()+interval '1 hour',now())`,
		`INSERT INTO assessments(id,assessment_code,owner_type,owner_school_id,workflow_status,current_version,published_version,is_published) VALUES
		 ('00000000-0000-0000-0000-000000000601','OVERVIEW-601','platform',NULL,'approved',1,1,true),
		 ('00000000-0000-0000-0000-000000000602','OVERVIEW-602','school','` + schoolB + `','approved',1,1,true),
		 ('00000000-0000-0000-0000-000000000603','OVERVIEW-603','school','` + schoolA + `','draft',1,NULL,false),
		 ('00000000-0000-0000-0000-000000000604','OVERVIEW-604','school','` + schoolB + `','approved',1,1,true)`,
		`INSERT INTO assessment_versions(assessment_id,version,title,path_id,assessment_kind,normal_mode,version_status,published_at) VALUES
		 ('00000000-0000-0000-0000-000000000601',1,'اختبار صفوف','` + pathID + `','normal','exam','published',now()),
		 ('00000000-0000-0000-0000-000000000602',1,'اختبار طالب','` + pathID + `','normal','exam','published',now()),
		 ('00000000-0000-0000-0000-000000000603',1,'مسودة','` + pathID + `','normal','exam','draft',NULL),
		 ('00000000-0000-0000-0000-000000000604',1,'اختبار مدرسة ب','` + pathID + `','normal','exam','published',now())`,
		`INSERT INTO assessment_assignments(id,assessment_id,assessment_version,school_id,status,created_by) VALUES
		 ('00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000601',1,'` + schoolA + `','active','` + teacher + `'),
		 ('00000000-0000-0000-0000-000000000702','00000000-0000-0000-0000-000000000602',1,'` + schoolA + `','active','` + teacher + `'),
		 ('00000000-0000-0000-0000-000000000703','00000000-0000-0000-0000-000000000603',1,'` + schoolA + `','active','` + teacher + `'),
		 ('00000000-0000-0000-0000-000000000704','00000000-0000-0000-0000-000000000604',1,'` + schoolB + `','active','` + teacher + `')`,
		`INSERT INTO assessment_assignment_classes(assignment_id,class_id) VALUES ('00000000-0000-0000-0000-000000000701','` + classA + `'),('00000000-0000-0000-0000-000000000701','` + classB + `'),('00000000-0000-0000-0000-000000000703','` + classA + `'),('00000000-0000-0000-0000-000000000704','` + otherClass + `')`,
		`INSERT INTO assessment_assignment_users(assignment_id,user_id) VALUES ('00000000-0000-0000-0000-000000000702','` + studentA + `')`,
	}
	for _, sql := range fixtures {
		if _, err := tx.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	// Validate deferred version FKs before rollback hides commit-time mistakes.
	if _, err := tx.Exec(ctx, `SET CONSTRAINTS ALL IMMEDIATE`); err != nil {
		t.Fatal(err)
	}

	directory := &SchoolDirectorDirectory{db: tx}
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
