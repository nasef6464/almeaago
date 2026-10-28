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
	page, err := listDirectorAssessmentQuestions(ctx, tx, director, school, path, subject, "", 1, 10)
	if err != nil || len(page.Items) != 1 || page.Items[0].ID != goodQuestion || page.HasMore {
		t.Fatalf("incorrect approved picker scope: %+v err=%v", page, err)
	}
	deniedPage, err := listDirectorAssessmentQuestions(ctx, tx, director, otherSchool, path, subject, "", 1, 10)
	if err != nil || len(deniedPage.Items) != 0 {
		t.Fatalf("cross-school picker disclosed items: %+v err=%v", deniedPage, err)
	}
	filtered, err := listDirectorAssessmentQuestions(ctx, tx, director, school, path, subject, "not-matching", 1, 10)
	if err != nil || len(filtered.Items) != 0 {
		t.Fatalf("picker search filter bypassed: %+v err=%v", filtered, err)
	}
	secondPage, err := listDirectorAssessmentQuestions(ctx, tx, director, school, path, subject, "", 2, 1)
	if err != nil || len(secondPage.Items) != 0 {
		t.Fatalf("picker pagination leaked earlier page: %+v err=%v", secondPage, err)
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

	// SCHOOL-005C: the report shares the exact current school audience, but
	// counts at most the latest submitted assigned result per learner.
	const learnerA = "00000000-0000-0000-0000-000000001501"
	const learnerB = "00000000-0000-0000-0000-000000001502"
	const learnerC = "00000000-0000-0000-0000-000000001503"
	const outside = "00000000-0000-0000-0000-000000001504"
	const disabled = "00000000-0000-0000-0000-000000001505"
	_, err = tx.Exec(ctx, `INSERT INTO users(id,email,name,password_hash,status) VALUES
	 ($1,'report-a@ci.invalid','متعلم أ','test','active'),
	 ($2,'report-b@ci.invalid','متعلم ب','test','active'),
	 ($3,'report-c@ci.invalid','متعلم ج','test','active'),
	 ($4,'report-out@ci.invalid','خارج المدرسة','test','active'),
	 ($5,'report-disabled@ci.invalid','معطل','test','disabled')`, learnerA, learnerB, learnerC, outside, disabled)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO school_memberships(school_id,user_id,role,status) VALUES
	 ($1,$3,'student','active'),($1,$4,'student','active'),($1,$5,'student','active'),
	 ($2,$6,'student','active'),($1,$7,'student','active')`, school, otherSchool, learnerA, learnerB, learnerC, outside, disabled)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO class_memberships(class_id,user_id,status) VALUES
	 ($1,$2,'active'),($1,$3,'active'),($1,$4,'active'),($1,$5,'active')`, classA, learnerA, learnerB, outside, disabled)
	if err != nil {
		t.Fatal(err)
	}
	var classAssignment, wholeAssignment string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM assessment_assignments WHERE assessment_id=$1::uuid`, created.AssessmentID).Scan(&classAssignment); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, `SELECT id::text FROM assessment_assignments WHERE assessment_id=$1::uuid`, schoolCreated.AssessmentID).Scan(&wholeAssignment); err != nil {
		t.Fatal(err)
	}
	const attemptOld = "00000000-0000-0000-0000-000000001601"
	const attemptNew = "00000000-0000-0000-0000-000000001602"
	const attemptSchoolB = "00000000-0000-0000-0000-000000001603"
	const foreignAssignment = "00000000-0000-0000-0000-000000001604"
	_, err = tx.Exec(ctx, `INSERT INTO assessment_assignments(id,assessment_id,assessment_version,school_id,created_by)
	 VALUES ($1,$2,1,$3,$4)`, foreignAssignment, created.AssessmentID, otherSchool, director)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO assessment_attempts(id,assessment_id,assessment_version,student_id,assignment_id,attempt_number,status,submitted_at) VALUES
	 ($1,$4,1,$5,$6,1,'submitted',now()),($2,$4,1,$5,$6,2,'submitted',now()),
	 ($3,$4,1,$5,$7,1,'submitted',now())`, attemptOld, attemptNew, attemptSchoolB, created.AssessmentID, learnerA, classAssignment, foreignAssignment)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO assessment_results(attempt_id,assessment_id,assessment_version,student_id,score,total_questions,correct_answers,wrong_answers,unanswered,passed,finalized_at) VALUES
	 ($1,$4,1,$5,20,1,0,1,0,false,now()-interval '2 minutes'),
	 ($2,$4,1,$5,80,1,1,0,0,true,now()-interval '1 minute'),
	 ($3,$4,1,$5,5,1,0,1,0,false,now())`, attemptOld, attemptNew, attemptSchoolB, created.AssessmentID, learnerA)
	if err != nil {
		t.Fatal(err)
	}
	classReport, err := readDirectorAssessmentReport(ctx, tx, director, school, created.AssessmentID)
	if err != nil || classReport.Audience.Targeted != 2 || classReport.Participation.Completed != 1 || classReport.Participation.NotCompleted != 1 ||
		classReport.Scores.Average == nil || *classReport.Scores.Average != 80 || classReport.Scores.PassRate == nil || *classReport.Scores.PassRate != 100 ||
		classReport.Coverage.Complete || classReport.Participation.Started != nil {
		t.Fatalf("wrong scoped/latest class report: %+v error=%v", classReport, err)
	}
	wholeReport, err := readDirectorAssessmentReport(ctx, tx, director, school, schoolCreated.AssessmentID)
	if err != nil || wholeReport.Audience.Targeted != 3 || wholeReport.Participation.Completed != 0 || wholeReport.Scores.Average != nil {
		t.Fatalf("wrong whole-school report: %+v error=%v", wholeReport, err)
	}
	if _, err := readDirectorAssessmentReport(ctx, tx, director, otherSchool, created.AssessmentID); !errors.Is(err, org.ErrNotFound) {
		t.Fatalf("cross-school assessment disclosure: %v", err)
	}
	// SCHOOL-005C2: aggregate permissions do not authorize named student
	// outcomes. Both the detailed capability and intelligence module are needed.
	const learnerQueryLimit = 12
	query := org.DirectorAssessmentLearnerQuery{Page: 1, Limit: learnerQueryLimit, Status: "all"}
	if _, err := readDirectorAssessmentLearners(ctx, tx, director, school, created.AssessmentID, query); !errors.Is(err, org.ErrNotFound) {
		t.Fatalf("aggregate-only director saw learner identities: %v", err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO school_membership_permissions(membership_id,permission)
	 SELECT id,'SCHOOL_REPORTS_DETAILED_VIEW' FROM school_memberships WHERE school_id=$1 AND user_id=$2 AND role='school_admin'`, school, director); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO school_contract_modules(contract_id,module_code,enabled)
	 SELECT id,'SCHOOL_INTELLIGENCE',true FROM school_contracts WHERE school_id=$1`, school); err != nil {
		t.Fatal(err)
	}
	list, err := readDirectorAssessmentLearners(ctx, tx, director, school, created.AssessmentID, query)
	if err != nil || list.Pagination.Total != 2 || len(list.Learners) != 2 || list.Learners[0].StudentID != learnerA || list.Learners[0].Result == nil || list.Learners[0].Result.ID != attemptNew || list.Learners[0].Result.Score != 80 || list.Learners[1].StudentID != learnerB || list.Learners[1].Result != nil {
		t.Fatalf("incorrect scoped/latest student roster: %+v err=%v", list, err)
	}
	for _, tt := range []struct {
		status string
		total  int
	}{
		{"completed", 1}, {"not_completed", 1}, {"needs_support", 0},
	} {
		query.Status = tt.status
		filtered, err := readDirectorAssessmentLearners(ctx, tx, director, school, created.AssessmentID, query)
		if err != nil || filtered.Pagination.Total != tt.total || len(filtered.Learners) != tt.total {
			t.Fatalf("wrong %s filter: %+v %v", tt.status, filtered, err)
		}
	}
	query.Status = "all"
	query.Search = "متعلم ب"
	searched, err := readDirectorAssessmentLearners(ctx, tx, director, school, created.AssessmentID, query)
	if err != nil || searched.Pagination.Total != 1 || searched.Learners[0].StudentID != learnerB {
		t.Fatalf("wrong named search: %+v %v", searched, err)
	}
	query.Search = "%"
	if escaped, err := readDirectorAssessmentLearners(ctx, tx, director, school, created.AssessmentID, query); err != nil || escaped.Pagination.Total != 0 {
		t.Fatalf("wildcard injected into search: %+v %v", escaped, err)
	}
	query.Search = ""
	query.Limit = 1
	query.Page = 2
	second, err := readDirectorAssessmentLearners(ctx, tx, director, school, created.AssessmentID, query)
	if err != nil || second.Pagination.Total != 2 || second.Pagination.TotalPages != 2 || len(second.Learners) != 1 || second.Learners[0].StudentID != learnerB {
		t.Fatalf("broken bounded pagination: %+v %v", second, err)
	}
	query.Page = 1
	query.Limit = 12
	studentResult, err := readDirectorAssessmentLearnerResult(ctx, tx, director, school, created.AssessmentID, attemptNew)
	if err != nil || studentResult.Result.ID != attemptNew || studentResult.Result.StudentID != learnerA || studentResult.Result.Score != 80 || studentResult.Result.TotalQuestions != 1 || studentResult.Result.AttemptNumber != 2 {
		t.Fatalf("wrong persisted learner evidence: %+v %v", studentResult, err)
	}
	for _, attemptID := range []string{attemptSchoolB, "00000000-0000-0000-0000-000000001999"} {
		if _, err := readDirectorAssessmentLearnerResult(ctx, tx, director, school, created.AssessmentID, attemptID); !errors.Is(err, org.ErrNotFound) {
			t.Fatalf("unauthorized/absent learner detail %s disclosed: %v", attemptID, err)
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE assessment_results SET passed=false,score=45 WHERE attempt_id=$1::uuid`, attemptNew); err != nil {
		t.Fatal(err)
	}
	query.Status = "needs_support"
	support, err := readDirectorAssessmentLearners(ctx, tx, director, school, created.AssessmentID, query)
	if err != nil || support.Pagination.Total != 1 || support.Learners[0].Result == nil || support.Learners[0].Result.Score != 45 {
		t.Fatalf("support must use latest saved passing decision: %+v %v", support, err)
	}
	if _, err := tx.Exec(ctx, `UPDATE school_contract_modules SET enabled=false WHERE module_code='SCHOOL_INTELLIGENCE'`); err != nil {
		t.Fatal(err)
	}
	if _, err := readDirectorAssessmentLearners(ctx, tx, director, school, created.AssessmentID, query); !errors.Is(err, org.ErrNotFound) {
		t.Fatalf("revoked intelligence module exposed roster: %v", err)
	}
	if _, err := readDirectorAssessmentLearnerResult(ctx, tx, director, school, created.AssessmentID, attemptNew); !errors.Is(err, org.ErrNotFound) {
		t.Fatalf("revoked intelligence module exposed detail: %v", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE school_contract_modules SET enabled=false WHERE module_code='SCHOOL_ASSESSMENTS'`); err != nil {
		t.Fatal(err)
	}
	if _, err := readDirectorAssessmentReport(ctx, tx, director, school, created.AssessmentID); !errors.Is(err, org.ErrNotFound) {
		t.Fatalf("revoked contract still exposes results: %v", err)
	}
}
