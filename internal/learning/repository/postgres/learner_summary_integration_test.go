package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	learninghttp "github.com/nasef6464/almeaago/internal/learning/transport/http"
)

func TestLearnerSummaryAchievementsCoursesAndCertificatePostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 1
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, stmt := range []string{
		"CREATE TEMP TABLE users (LIKE public.users INCLUDING ALL)",
		"CREATE TEMP TABLE paths (LIKE public.paths INCLUDING ALL)",
		"CREATE TEMP TABLE subjects (LIKE public.subjects INCLUDING ALL)",
		"CREATE TEMP TABLE assets (LIKE public.assets INCLUDING ALL)",
		"CREATE TEMP TABLE lessons (LIKE public.lessons INCLUDING ALL)",
		"CREATE TEMP TABLE courses (LIKE public.courses INCLUDING ALL)",
		"CREATE TEMP TABLE course_modules (LIKE public.course_modules INCLUDING ALL)",
		"CREATE TEMP TABLE course_lessons (LIKE public.course_lessons INCLUDING ALL)",
		"CREATE TEMP TABLE commerce_products (LIKE public.commerce_products INCLUDING ALL)",
		"CREATE TEMP TABLE commerce_packages (LIKE public.commerce_packages INCLUDING ALL)",
		"CREATE TEMP TABLE commerce_package_items (LIKE public.commerce_package_items INCLUDING ALL)",
		"CREATE TEMP TABLE commerce_entitlements (LIKE public.commerce_entitlements INCLUDING ALL)",
		"CREATE TEMP TABLE lesson_progress (LIKE public.lesson_progress INCLUDING ALL)",
		"CREATE TEMP TABLE assessment_versions (LIKE public.assessment_versions INCLUDING ALL)",
		"CREATE TEMP TABLE assessment_results (LIKE public.assessment_results INCLUDING ALL)",
		"CREATE TEMP TABLE skill_progress (LIKE public.skill_progress INCLUDING ALL)",
		"CREATE TEMP TABLE review_answer_submissions (LIKE public.review_answer_submissions INCLUDING ALL)",
		"CREATE TEMP TABLE session_bookings (LIKE public.session_bookings INCLUDING ALL)",
		"CREATE TEMP TABLE course_certificates (LIKE public.course_certificates INCLUDING ALL)",
		"CREATE TEMP TABLE audit_logs (LIKE public.audit_logs INCLUDING ALL)",
	} {
		if _, err := db.Exec(ctx, stmt); err != nil {
			t.Fatalf("setup %s: %v", stmt, err)
		}
	}

	const studentID = "00000000-0000-4000-8000-000000000101"
	const pathID = "00000000-0000-4000-8000-000000000201"
	const subjectID = "00000000-0000-4000-8000-000000000202"
	const courseID = "00000000-0000-4000-8000-000000000301"
	const modID = "00000000-0000-4000-8000-000000000302"
	const lesson1 = "00000000-0000-4000-8000-000000000401"
	const lesson2 = "00000000-0000-4000-8000-000000000402"
	const skill1 = "00000000-0000-4000-8000-000000000501"
	const assessID = "00000000-0000-4000-8000-000000000601"
	const attemptID = "00000000-0000-4000-8000-000000000701"
	const productID = "00000000-0000-4000-8000-000000000801"
	const entID = "00000000-0000-4000-8000-000000000802"

	now := time.Now().UTC()
	yesterday := now.Add(-24 * time.Hour)

	for _, sql := range []string{
		`INSERT INTO users(id,email,name,status) VALUES ('` + studentID + `','student-summary@example.invalid','نورة العتيبي','active')`,
		`INSERT INTO paths(id,code,name,status) VALUES ('` + pathID + `','P-1','القدرات','active')`,
		`INSERT INTO subjects(id,path_id,code,name,status) VALUES ('` + subjectID + `','` + pathID + `','S-1','الكمي','active')`,
		`INSERT INTO lessons(id,path_id,subject_id,title,lesson_type,duration_seconds,workflow_status,is_visible) VALUES
			('` + lesson1 + `','` + pathID + `','` + subjectID + `','الدرس الأول','video',600,'approved',true),
			('` + lesson2 + `','` + pathID + `','` + subjectID + `','الدرس الثاني','video',900,'approved',true)`,
		`INSERT INTO courses(id,path_id,subject_id,title,description,instructor_name,certificate_enabled,workflow_status,is_published,is_visible,published_at) VALUES
			('` + courseID + `','` + pathID + `','` + subjectID + `','دورة الكمي الشاملة','وصف','أ. خالد',true,'approved',true,true,now())`,
		`INSERT INTO course_modules(id,course_id,title,sort_order,status) VALUES ('` + modID + `','` + courseID + `','الوحدة 1',1,'active')`,
		`INSERT INTO course_lessons(module_id,lesson_id,sort_order) VALUES ('` + modID + `','` + lesson1 + `',1),('` + modID + `','` + lesson2 + `',2)`,
		`INSERT INTO commerce_products(id,code,product_type,name,course_id,price_minor,currency,status) VALUES
			('` + productID + `','PR-1','course','منتج','` + courseID + `',1000,'SAR','active')`,
		`INSERT INTO commerce_entitlements(id,subject_type,user_id,product_id,source_type,source_id,status,starts_at,idempotency_key) VALUES
			('` + entID + `','user','` + studentID + `','` + productID + `','admin_manual','seed-1','active',now()-interval '1 day','ent-seed-1')`,
		`INSERT INTO assessment_versions(assessment_id,version,title,path_id,assessment_kind,normal_mode,version_status,published_at) VALUES
			('` + assessID + `',1,'اختبار قياس 1','` + pathID + `','normal','exam','published',now())`,
		`INSERT INTO skill_progress(student_id,path_id,subject_id,skill_id,mastery,evidence_count) VALUES ('` + studentID + `','` + pathID + `','` + subjectID + `','` + skill1 + `',85,6)`,
	} {
		if _, err := db.Exec(ctx, sql); err != nil {
			t.Fatalf("seed failed (%s): %v", sql, err)
		}
	}

	// Lesson 1 completed today, assessment result 100% yesterday -> 2-day Riyadh streak!
	if _, err := db.Exec(ctx, `
		INSERT INTO lesson_progress(student_id,lesson_id,context_type,course_id,status,completed_at,updated_at)
		VALUES ($1,'`+lesson1+`','course','`+courseID+`','completed',$2,$2)
	`, studentID, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `
		INSERT INTO assessment_results(attempt_id,assessment_id,assessment_version,student_id,score,passed,total_questions,correct_answers,wrong_answers,unanswered,time_spent_seconds,finalized_at)
		VALUES ('`+attemptID+`','`+assessID+`',1,$1,100,true,10,10,0,0,120,$2)
	`, studentID, yesterday); err != nil {
		t.Fatal(err)
	}

	repo := New(db)
	svc := learningapp.NewLessonProgressService(repo, nil)
	actor := identity.User{ID: studentID, Roles: []identity.Role{identity.RoleStudent}}

	summary, err := svc.AchievementsSummary(ctx, actor)
	if err != nil {
		t.Fatalf("AchievementsSummary error: %v", err)
	}
	if summary.CompletedLessons != 1 || summary.CompletedQuizzes != 1 || summary.PerfectQuizzes != 1 || summary.MasteredSkills != 1 || summary.EnrolledCourses != 1 {
		t.Fatalf("unexpected achievement counts: %+v", summary)
	}
	if summary.StreakDays < 2 {
		t.Fatalf("expected streak >= 2 days across today & yesterday, got %d", summary.StreakDays)
	}
	if len(summary.Timeline) != 2 {
		t.Fatalf("expected 2 timeline items, got %d", len(summary.Timeline))
	}

	courses, err := svc.CoursesProgressSummary(ctx, actor)
	if err != nil || len(courses) != 1 {
		t.Fatalf("CoursesProgressSummary failed: len=%d err=%v", len(courses), err)
	}
	if !courses[0].IsEnrolled || courses[0].LessonsCount != 2 || courses[0].CompletedLessonsCount != 1 || courses[0].Progress != 50 {
		t.Fatalf("unexpected course summary: %+v", courses[0])
	}

	// Certificate must return ErrConflict before 100% completion.
	if _, err := svc.IssueCourseCertificate(ctx, actor, courseID); !errors.Is(err, learning.ErrConflict) {
		t.Fatalf("expected ErrConflict for incomplete course certificate, got %v", err)
	}

	// Complete lesson 2 -> 100% -> certificate issued cleanly + idempotent on second call.
	if _, err := db.Exec(ctx, `
		INSERT INTO lesson_progress(student_id,lesson_id,context_type,course_id,status,completed_at,updated_at)
		VALUES ($1,'`+lesson2+`','course','`+courseID+`','completed',$2,$2)
	`, studentID, now); err != nil {
		t.Fatal(err)
	}

	cert1, err := svc.IssueCourseCertificate(ctx, actor, courseID)
	if err != nil || cert1.VerificationCode == "" {
		t.Fatalf("IssueCourseCertificate failed: %+v err=%v", cert1, err)
	}
	cert2, err := svc.IssueCourseCertificate(ctx, actor, courseID)
	if err != nil || cert2.ID != cert1.ID || cert2.VerificationCode != cert1.VerificationCode {
		t.Fatalf("IssueCourseCertificate second call must return existing cert: %+v vs %+v err=%v", cert2, cert1, err)
	}

	mine, err := svc.MyCertificates(ctx, actor)
	if err != nil || len(mine) != 1 {
		t.Fatalf("MyCertificates failed: len=%d err=%v", len(mine), err)
	}
	if mine[0].VerificationCode != cert1.VerificationCode || mine[0].CourseName != "دورة الكمي الشاملة" || mine[0].StudentName != "نورة العتيبي" || mine[0].CompletionPercentage != 100 {
		t.Fatalf("unexpected MyCertificates projection: %+v", mine[0])
	}

	byCode, err := svc.CertificateByCode(ctx, cert1.VerificationCode)
	if err != nil || byCode.StudentName != "نورة العتيبي" || byCode.CourseName != "دورة الكمي الشاملة" {
		t.Fatalf("CertificateByCode failed: %+v err=%v", byCode, err)
	}
	if _, err := svc.CertificateByCode(ctx, "ALM-CERT-MISSING"); !errors.Is(err, learning.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for unknown code, got %v", err)
	}

	handler := learninghttp.NewLessonProgress(svc, nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/certificates/"+cert1.VerificationCode, nil))
	var public struct {
		Certificate map[string]any `json:"certificate"`
	}
	if response.Code != http.StatusOK || json.Unmarshal(response.Body.Bytes(), &public) != nil {
		t.Fatalf("public verification failed: %d %s", response.Code, response.Body.String())
	}
	for _, field := range []string{"id", "userId", "courseId"} {
		if _, included := public.Certificate[field]; included {
			t.Fatalf("public response exposed internal field %s", field)
		}
	}
	if public.Certificate["verificationCode"] != cert1.VerificationCode || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("public certificate omitted verification data or cache protection")
	}
	missing := httptest.NewRecorder()
	handler.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/certificates/ALM-CERT-MISSING", nil))
	if missing.Code != http.StatusNotFound {
		t.Fatalf("unknown verification code: expected 404, got %d", missing.Code)
	}
}
