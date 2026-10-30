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

	// Source Node lists targeted school assessments (including unpublished
	// targeted school drafts) and excludes the other school's private items.
	workspace, err := directory.DirectorAssessments(ctx, schoolA)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Assessments) != 3 || len(workspace.Classes) != 2 {
		t.Fatalf("school A assessment workspace has incorrect audience: %+v", workspace)
	}
	for _, item := range workspace.Assessments {
		if item.ID == "00000000-0000-0000-0000-000000000604" {
			t.Fatalf("school B private assessment leaked to A: %+v", item)
		}
	}
	workspaceB, err := directory.DirectorAssessments(ctx, schoolB)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspaceB.Assessments) != 1 || workspaceB.Assessments[0].ID != "00000000-0000-0000-0000-000000000604" {
		t.Fatalf("school B assessment workspace incorrect: %+v", workspaceB)
	}

	// Negative audiences: scope-only assignment, wrong-school classroom,
	// outside-school student; positive explicit whole-school and central draft.
	if _, err := tx.Exec(ctx, `SET CONSTRAINTS ALL DEFERRED`); err != nil {
		t.Fatal(err)
	}
	additional := []string{
		`INSERT INTO assessments(id,assessment_code,owner_type,owner_school_id,workflow_status,current_version,published_version,is_published,is_school_central_draft) VALUES
		 ('00000000-0000-0000-0000-000000000605','OVERVIEW-605','school','` + schoolA + `','approved',1,1,true,false),
		 ('00000000-0000-0000-0000-000000000606','OVERVIEW-606','school','` + schoolA + `','draft',1,NULL,false,true),
		 ('00000000-0000-0000-0000-000000000607','OVERVIEW-607','platform',NULL,'approved',1,1,true,false),
		 ('00000000-0000-0000-0000-000000000608','OVERVIEW-608','platform',NULL,'approved',1,1,true,false),
		 ('00000000-0000-0000-0000-000000000609','OVERVIEW-609','platform',NULL,'approved',1,1,true,false)`,
		`INSERT INTO assessment_versions(assessment_id,version,title,path_id,subject_id,assessment_kind,normal_mode,version_status,published_at) VALUES
		 ('00000000-0000-0000-0000-000000000605',1,'نطاق بلا جمهور','` + pathID + `','` + subjectID + `','normal','exam','published',now()),
		 ('00000000-0000-0000-0000-000000000606',1,'مسودة مركزية','` + pathID + `','` + subjectID + `','normal','exam','draft',NULL),
		 ('00000000-0000-0000-0000-000000000607',1,'فصل في مدرسة أخرى','` + pathID + `','` + subjectID + `','normal','exam','published',now()),
		 ('00000000-0000-0000-0000-000000000608',1,'اختبار المدرسة كلها','` + pathID + `','` + subjectID + `','normal','exam','published',now()),
		 ('00000000-0000-0000-0000-000000000609',1,'طالب خارج المدرسة','` + pathID + `','` + subjectID + `','normal','exam','published',now())`,
		`INSERT INTO assessment_assignments(id,assessment_id,assessment_version,school_id,status,created_by,targets_entire_school) VALUES
		 ('00000000-0000-0000-0000-000000000705','00000000-0000-0000-0000-000000000605',1,'` + schoolA + `','active','` + teacher + `',false),
		 ('00000000-0000-0000-0000-000000000707','00000000-0000-0000-0000-000000000607',1,'` + schoolB + `','active','` + teacher + `',false),
		 ('00000000-0000-0000-0000-000000000708','00000000-0000-0000-0000-000000000608',1,'` + schoolA + `','active','` + teacher + `',true),
		 ('00000000-0000-0000-0000-000000000709','00000000-0000-0000-0000-000000000609',1,'` + schoolA + `','active','` + teacher + `',false),
		 ('00000000-0000-0000-0000-000000000710','00000000-0000-0000-0000-000000000608',1,'` + schoolA + `','active','` + teacher + `',true)`,
		`INSERT INTO assessment_assignment_classes(assignment_id,class_id) VALUES ('00000000-0000-0000-0000-000000000707','` + classA + `')`,
		`INSERT INTO assessment_assignment_users(assignment_id,user_id) VALUES ('00000000-0000-0000-0000-000000000709','` + studentOther + `')`,
	}
	for _, sql := range additional {
		if _, err := tx.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := tx.Exec(ctx, `SET CONSTRAINTS ALL IMMEDIATE`); err != nil {
		t.Fatal(err)
	}
	updated, err := directory.DirectorAssessments(ctx, schoolA)
	if err != nil {
		t.Fatal(err)
	}
	if len(updated.Assessments) != 5 {
		t.Fatalf("expected 3 targeted, 1 whole-school, 1 central draft; got %+v", updated.Assessments)
	}
	seen := map[string]orgDirectorAssessmentProbe{}
	for _, item := range updated.Assessments {
		seen[item.ID] = orgDirectorAssessmentProbe{groups: item.TargetGroupIDs, published: item.IsPublished}
	}
	for _, forbidden := range []string{"605", "607", "609"} {
		if _, exists := seen["00000000-0000-0000-0000-000000000"+forbidden]; exists {
			t.Fatalf("assessment %s widened school audience", forbidden)
		}
	}
	if len(seen["00000000-0000-0000-0000-000000000608"].groups) != 1 || seen["00000000-0000-0000-0000-000000000608"].groups[0] != schoolA {
		t.Fatalf("whole school target not explicit: %+v", seen)
	}
	if seen["00000000-0000-0000-0000-000000000606"].published {
		t.Fatal("central school draft must remain unpublished")
	}
	updatedOverview, err := directory.DirectorOverview(ctx, schoolA)
	if err != nil || updatedOverview.Metrics.SchoolAssessments != 3 {
		t.Fatalf("overview published audience count must include explicit school once: %+v err=%v", updatedOverview.Metrics, err)
	}
}

type orgDirectorAssessmentProbe struct {
	groups    []string
	published bool
}
