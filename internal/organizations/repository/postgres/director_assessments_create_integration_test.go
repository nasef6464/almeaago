package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type directorAssessmentAuditProbe struct{ calls int }

func (a *directorAssessmentAuditProbe) WriteTx(_ context.Context, _ pgx.Tx, _ operations.AuditEvent) error {
	a.calls++
	return nil
}

// Real public migrations, real deferrable foreign keys. Every fixture row
// belongs to this transaction and vanishes on rollback, including successes.
func TestDirectorCreateAssessmentPostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required; Database CI applies all migrations")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(context.Background())

	const school = "00000000-0000-0000-0000-000000001001"
	const otherSchool = "00000000-0000-0000-0000-000000001002"
	const director = "00000000-0000-0000-0000-000000001003"
	const classA = "00000000-0000-0000-0000-000000001101"
	const classB = "00000000-0000-0000-0000-000000001102"
	const path = "00000000-0000-0000-0000-000000001201"
	const otherPath = "00000000-0000-0000-0000-000000001202"
	const subject = "00000000-0000-0000-0000-000000001203"
	const otherSubject = "00000000-0000-0000-0000-000000001204"
	const goodQuestion = "00000000-0000-0000-0000-000000001301"
	const draftQuestion = "00000000-0000-0000-0000-000000001302"
	const wrongQuestion = "00000000-0000-0000-0000-000000001303"
	const key = "00000000-0000-0000-0000-000000001401"

	fixtures := []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO users(id,email,name,password_hash) VALUES ($1,'assessment-director@ci.invalid','مدير اختبارات','test-only')`, []any{director}},
		{`INSERT INTO schools(id,code,name) VALUES ($1,'ASSESS-A','مدرسة أ'),($2,'ASSESS-B','مدرسة ب')`, []any{school, otherSchool}},
		{`INSERT INTO classes(id,school_id,code,name) VALUES ($1,$2,'ASSESS-A1','فصل أ'),($3,$4,'ASSESS-B1','فصل ب')`, []any{classA, school, classB, otherSchool}},
		{`INSERT INTO paths(id,code,name) VALUES ($1,'ASSESS-P1','قدرات'),($2,'ASSESS-P2','تحصيلي')`, []any{path, otherPath}},
		{`INSERT INTO subjects(id,path_id,code,name) VALUES ($1,$2,'ASSESS-S1','رياضيات'),($3,$4,'ASSESS-S2','علوم')`, []any{subject, path, otherSubject, otherPath}},
		{`INSERT INTO school_memberships(school_id,user_id,role,status) VALUES ($1,$2,'school_admin','active')`, []any{school, director}},
		{`INSERT INTO school_membership_permissions(membership_id,permission) SELECT id,'SCHOOL_ASSESSMENTS_MANAGE' FROM school_memberships WHERE school_id=$1 AND user_id=$2 AND role='school_admin'`, []any{school, director}},
		{`INSERT INTO school_contracts(school_id,status) VALUES ($1,'active')`, []any{school}},
		{`INSERT INTO school_contract_modules(contract_id,module_code,enabled) SELECT id,'SCHOOL_ASSESSMENTS',true FROM school_contracts WHERE school_id=$1`, []any{school}},
		{`INSERT INTO questions(id,question_code,current_version,workflow_status,path_id,subject_id) VALUES
		 ($1,'ASSESS-Q1',1,'approved',$4,$5),($2,'ASSESS-Q2',1,'draft',$4,$5),($3,'ASSESS-Q3',1,'approved',$6,$7)`, []any{goodQuestion, draftQuestion, wrongQuestion, path, subject, otherPath, otherSubject}},
		{`INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index) VALUES
		 ($1,1,'mcq','سؤال معتمد',0),($2,1,'mcq','سؤال غير معتمد',0),($3,1,'mcq','سؤال من مسار آخر',0)`, []any{goodQuestion, draftQuestion, wrongQuestion}},
	}
	for _, fixture := range fixtures {
		if _, err := tx.Exec(ctx, fixture.sql, fixture.args...); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := tx.Exec(ctx, `SET CONSTRAINTS ALL IMMEDIATE`); err != nil {
		t.Fatal(err)
	}
	// The assessment references its version and vice versa. Production starts
	// with deferred constraints; explicitly restore that state for this fixture.
	if _, err := tx.Exec(ctx, `SET CONSTRAINTS ALL DEFERRED`); err != nil {
		t.Fatal(err)
	}
	// The picker must not leak drafts, other paths, or another school's bank.
	page, err := listDirectorAssessmentQuestions(ctx, tx, director, school, path, subject, "", 10)
	if err != nil || len(page.Items) != 1 || page.Items[0].ID != goodQuestion || page.HasMore {
		t.Fatalf("incorrect approved picker scope: %+v err=%v", page, err)
	}
	deniedPage, err := listDirectorAssessmentQuestions(ctx, tx, director, otherSchool, path, subject, "", 10)
	if err != nil || len(deniedPage.Items) != 0 {
		t.Fatalf("cross-school picker disclosed items: %+v err=%v", deniedPage, err)
	}
	filtered, err := listDirectorAssessmentQuestions(ctx, tx, director, school, path, subject, "not-matching", 10)
	if err != nil || len(filtered.Items) != 0 {
		t.Fatalf("picker search filter bypassed: %+v err=%v", filtered, err)
	}

	probe := &directorAssessmentAuditProbe{}
	valid := org.DirectorAssessmentCreate{
		Title: "اختبار الفصل", ClassID: classA, TargetScope: "class",
		PathID: path, SubjectID: subject, QuestionIDs: []string{goodQuestion}, RequestKey: key,
	}
	created, err := createDirectorAssessmentTx(ctx, tx, probe, director, school, valid)
	if err != nil {
		t.Fatal(err)
	}
	if created.AssessmentID == "" || created.ClassID != classA || created.TargetScope != "class" || probe.calls != 1 {
		t.Fatalf("wrong class-created contract: %+v audits=%d", created, probe.calls)
	}
	var published, wholeSchool bool
	var owner, audienceClass string
	if err := tx.QueryRow(ctx, `SELECT is_published,owner_school_id::text FROM assessments WHERE id=$1::uuid`, created.AssessmentID).Scan(&published, &owner); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, `SELECT aa.targets_entire_school,c.class_id::text FROM assessment_assignments aa JOIN assessment_assignment_classes c ON c.assignment_id=aa.id WHERE aa.assessment_id=$1::uuid`, created.AssessmentID).Scan(&wholeSchool, &audienceClass); err != nil {
		t.Fatal(err)
	}
	if !published || owner != school || wholeSchool || audienceClass != classA {
		t.Fatalf("incorrect persisted class audience: published=%v owner=%s whole=%v class=%s", published, owner, wholeSchool, audienceClass)
	}

	repeat, err := createDirectorAssessmentTx(ctx, tx, probe, director, school, valid)
	if err != nil || repeat.AssessmentID != created.AssessmentID || probe.calls != 1 {
		t.Fatalf("same request key must be idempotent: %+v err=%v audits=%d", repeat, err, probe.calls)
	}
	conflicting := valid
	conflicting.Title = "اختبار مختلف بنفس المفتاح"
	if _, err := createDirectorAssessmentTx(ctx, tx, probe, director, school, conflicting); !errors.Is(err, org.ErrConflict) {
		t.Fatalf("changed payload with same token must conflict: %v", err)
	}

	badCases := []struct {
		name   string
		write  org.DirectorAssessmentCreate
		school string
	}{
		{name: "cross-school classroom", write: func() org.DirectorAssessmentCreate {
			w := valid
			w.ClassID = classB
			w.RequestKey = "00000000-0000-0000-0000-000000001402"
			return w
		}(), school: school},
		{name: "question not approved", write: func() org.DirectorAssessmentCreate {
			w := valid
			w.QuestionIDs = []string{draftQuestion}
			w.RequestKey = "00000000-0000-0000-0000-000000001403"
			return w
		}(), school: school},
		{name: "wrong path question", write: func() org.DirectorAssessmentCreate {
			w := valid
			w.QuestionIDs = []string{wrongQuestion}
			w.RequestKey = "00000000-0000-0000-0000-000000001404"
			return w
		}(), school: school},
		{name: "wrong school permission", write: func() org.DirectorAssessmentCreate {
			w := valid
			w.RequestKey = "00000000-0000-0000-0000-000000001405"
			return w
		}(), school: otherSchool},
	}
	for _, tc := range badCases {
		_, err := createDirectorAssessmentTx(ctx, tx, probe, director, tc.school, tc.write)
		if err == nil {
			t.Fatalf("%s accepted invalid school assessment", tc.name)
		}
	}

	schoolMode := valid
	schoolMode.RequestKey = "00000000-0000-0000-0000-000000001406"
	schoolMode.TargetScope = "school"
	schoolMode.ClassID = ""
	schoolCreated, err := createDirectorAssessmentTx(ctx, tx, probe, director, school, schoolMode)
	if err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, `SELECT targets_entire_school FROM assessment_assignments WHERE assessment_id=$1::uuid`, schoolCreated.AssessmentID).Scan(&wholeSchool); err != nil || !wholeSchool {
		t.Fatalf("whole-school assignment flag missing: %v", err)
	}
}
