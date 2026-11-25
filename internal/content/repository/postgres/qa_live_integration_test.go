package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

func TestQALiveSessionsScopeAndIdempotencyPostgres(t *testing.T) {
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
		"CREATE TEMP TABLE courses (LIKE public.courses INCLUDING ALL)",
		"CREATE TEMP TABLE lessons (LIKE public.lessons INCLUDING ALL)",
		"CREATE TEMP TABLE classes (LIKE public.classes INCLUDING ALL)",
		"CREATE TEMP TABLE class_memberships (LIKE public.class_memberships INCLUDING ALL)",
		"CREATE TEMP TABLE classroom_sessions (LIKE public.classroom_sessions INCLUDING ALL)",
		"CREATE TEMP TABLE commerce_products (LIKE public.commerce_products INCLUDING ALL)",
		"CREATE TEMP TABLE commerce_packages (LIKE public.commerce_packages INCLUDING ALL)",
		"CREATE TEMP TABLE commerce_package_items (LIKE public.commerce_package_items INCLUDING ALL)",
		"CREATE TEMP TABLE commerce_entitlements (LIKE public.commerce_entitlements INCLUDING ALL)",
		"CREATE TEMP TABLE course_qa_questions (LIKE public.course_qa_questions INCLUDING ALL)",
		"CREATE TEMP TABLE course_qa_replies (LIKE public.course_qa_replies INCLUDING ALL)",
		"CREATE TEMP TABLE audit_logs (LIKE public.audit_logs INCLUDING ALL)",
	} {
		if _, err := db.Exec(ctx, stmt); err != nil {
			t.Fatalf("setup %s: %v", stmt, err)
		}
	}

	const studentID = "00000000-0000-4000-8000-000000000011"
	const teacherID = "00000000-0000-4000-8000-000000000012"
	const visiblePath = "00000000-0000-4000-8000-000000000021"
	const hiddenPath = "00000000-0000-4000-8000-000000000022"
	const subjectID = "00000000-0000-4000-8000-000000000031"
	const courseID = "00000000-0000-4000-8000-000000000041"
	const freeLive = "00000000-0000-4000-8000-000000000051"
	const lockedLive = "00000000-0000-4000-8000-000000000052"
	const classID = "00000000-0000-4000-8000-000000000061"

	for _, sql := range []string{
		`INSERT INTO users(id,email,name,password_hash) VALUES
			('` + studentID + `','s@example.invalid','طالب','h'),
			('` + teacherID + `','t@example.invalid','أ. ماجد','h')`,
		`INSERT INTO paths(id,code,name,status,presentation) VALUES
			('` + visiblePath + `','P-VIS','القدرات','active','{"isVisible":true}'::jsonb),
			('` + hiddenPath + `','P-HID','مخفي','active','{"isVisible":false}'::jsonb)`,
		`INSERT INTO subjects(id,path_id,code,name,status) VALUES ('` + subjectID + `','` + visiblePath + `','S1','الكمي','active')`,
		`INSERT INTO courses(id,path_id,subject_id,title,workflow_status,is_published,is_visible) VALUES
			('` + courseID + `','` + visiblePath + `','` + subjectID + `','دورة جبر','approved',true,true)`,
		`INSERT INTO lessons(id,path_id,subject_id,title,lesson_type,meeting_url,is_locked,assigned_teacher_id,workflow_status,is_visible,duration_seconds) VALUES
			('` + freeLive + `','` + visiblePath + `','` + subjectID + `','بث مجاني','zoom','https://zoom.us/j/111',false,'` + teacherID + `','approved',true,3600),
			('` + lockedLive + `','` + visiblePath + `','` + subjectID + `','بث مقفل','zoom','https://zoom.us/j/secret',true,'` + teacherID + `','approved',true,3600)`,
		`INSERT INTO classes(id,school_id,code,name) VALUES ('` + classID + `','00000000-0000-0000-0000-000000000099','CL1','فصل 1')`,
		`INSERT INTO class_memberships(class_id,user_id,status) VALUES ('` + classID + `','` + studentID + `','active')`,
		`INSERT INTO classroom_sessions(school_id,class_id,subject_id,teacher_id,status,day,pin_hash,pin_expires_at,started_at) VALUES
			('00000000-0000-4000-8000-000000000099','` + classID + `','` + subjectID + `','` + teacherID + `','live','2026-11-25',repeat('a',64),now()+interval '1 hour',now())`,
	} {
		if _, err := db.Exec(ctx, sql); err != nil {
			t.Fatalf("seed (%s): %v", sql, err)
		}
	}

	repo := New(db, nil)
	svc := contentapp.NewService(repo)
	student := identity.User{ID: studentID, Roles: []identity.Role{identity.RoleStudent}}
	teacher := identity.User{ID: teacherID, Roles: []identity.Role{identity.RoleTeacher}}

	// Hidden-path question must not be visible to students.
	if _, err := svc.CreateQAQuestion(ctx, teacher, "", hiddenPath, "", "عام", "سؤال من مسار مخفي", "qa-req-hidden-01"); err != nil {
		t.Fatal(err)
	}
	q1, err := svc.CreateQAQuestion(ctx, student, courseID, visiblePath, subjectID, "الكمي", "كيف أحل المعادلات التربيعية؟", "qa-req-vis-001")
	if err != nil {
		t.Fatal(err)
	}
	// Duplicate requestId must be idempotent.
	q1Dup, err := svc.CreateQAQuestion(ctx, student, courseID, visiblePath, subjectID, "الكمي", "كيف أحل المعادلات التربيعية؟", "qa-req-vis-001")
	if err != nil || q1Dup.ID != q1.ID {
		t.Fatalf("QA question idempotency failed: %+v vs %+v err=%v", q1Dup, q1, err)
	}

	studentFeed, err := svc.ListQAQuestions(ctx, student, "", "all", "", 50)
	if err != nil || len(studentFeed.Items) != 1 || studentFeed.Items[0].ID != q1.ID {
		t.Fatalf("student QA feed must exclude hidden path: %+v err=%v", studentFeed, err)
	}
	if studentFeed.Stats.Total != 1 || studentFeed.Stats.Pending != 1 || studentFeed.Stats.Answered != 0 {
		t.Fatalf("unexpected QA stats before reply: %+v", studentFeed.Stats)
	}

	// Teacher replies & student resolves.
	rep, err := svc.CreateQAReply(ctx, teacher, q1.ID, "استخدم القانون العام", "qa-reply-0001")
	if err != nil || !rep.IsInstructor {
		t.Fatalf("teacher reply failed: %+v err=%v", rep, err)
	}
	if err := svc.ResolveQAQuestion(ctx, student, q1.ID); err == nil {
		t.Fatalf("student must not be able to resolve QA question directly")
	}
	if err := svc.ResolveQAQuestion(ctx, teacher, q1.ID); err != nil {
		t.Fatalf("resolve failed: %v", err)
	}
	afterReply, err := svc.ListQAQuestions(ctx, student, courseID, "answered", "القانون", 50)
	if err != nil || len(afterReply.Items) != 1 || !afterReply.Items[0].HasAnswer || !afterReply.Items[0].IsResolved {
		t.Fatalf("after reply/resolve feed unexpected: %+v err=%v", afterReply, err)
	}

	// Live sessions: locked meeting URL must be redacted for unenrolled student, visible for free/teacher.
	liveFeed, err := svc.ListLearnerLiveSessions(ctx, student)
	if err != nil || len(liveFeed.Lessons) != 2 || len(liveFeed.ClassroomSessions) != 1 {
		t.Fatalf("live sessions feed unexpected: %+v err=%v", liveFeed, err)
	}
	for _, lesson := range liveFeed.Lessons {
		if lesson.ID == lockedLive && (!lesson.IsLocked || lesson.MeetingURL != "") {
			t.Fatalf("locked live lesson leaked meeting URL: %+v", lesson)
		}
		if lesson.ID == freeLive && (lesson.IsLocked || lesson.MeetingURL == "") {
			t.Fatalf("free live lesson missing meeting URL: %+v", lesson)
		}
	}
}
