package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

// This test uses the real migrated PostgreSQL relation name and column types,
// but shadows it with a session-local temporary table. It never writes a
// learner's durable progress or requires foreign-key fixture records.
func TestCompletedStudyPlanLessonsPostgres(t *testing.T) {
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
	cfg.MaxConns = 1 // The temporary table must remain visible to every query.
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if _, err = db.Exec(ctx, `CREATE TEMP TABLE lesson_progress AS SELECT * FROM public.lesson_progress WITH NO DATA`); err != nil {
		t.Fatalf("expected the migrated public.lesson_progress relation: %v", err)
	}

	const student = "00000000-0000-0000-0000-000000000101"
	const otherStudent = "00000000-0000-0000-0000-000000000102"
	const lessonA = "00000000-0000-0000-0000-000000000201"
	const lessonB = "00000000-0000-0000-0000-000000000202"
	const courseA = "00000000-0000-0000-0000-000000000301"
	const courseB = "00000000-0000-0000-0000-000000000302"
	const topic = "00000000-0000-0000-0000-000000000401"

	_, err = db.Exec(ctx, `
		INSERT INTO pg_temp.lesson_progress
			(student_id, lesson_id, context_type, course_id, topic_id, status)
		VALUES
			($1::uuid,$3::uuid,'course',$5::uuid,NULL,'completed'),
			($1::uuid,$3::uuid,'course',$6::uuid,NULL,'in_progress'),
			($1::uuid,$4::uuid,'course',$5::uuid,NULL,'in_progress'),
			($1::uuid,$4::uuid,'course',$6::uuid,NULL,'completed'),
			($2::uuid,$4::uuid,'course',$5::uuid,NULL,'completed'),
			($1::uuid,$4::uuid,'foundation',NULL,$7::uuid,'completed')
	`, student, otherStudent, lessonA, lessonB, courseA, courseB, topic)
	if err != nil {
		t.Fatal(err)
	}

	repo := New(db)
	refs := []learning.StudyPlanLessonRef{
		{LessonID: lessonA, CourseID: courseA},
		{LessonID: lessonA, CourseID: courseB},
		{LessonID: lessonB, CourseID: courseA},
		{LessonID: lessonB, CourseID: courseB},
		{LessonID: lessonA, CourseID: courseA}, // A duplicate must not multiply results.
	}
	got, err := repo.CompletedStudyPlanLessons(ctx, student, refs)
	if err != nil {
		t.Fatalf("study-plan completion lookup must use the migrated progress table: %v", err)
	}
	if len(got) != 2 || !got[lessonA+":"+courseA] || !got[lessonB+":"+courseB] {
		t.Fatalf("expected only the student's completed course lessons, got %#v", got)
	}
	if got[lessonA+":"+courseB] || got[lessonB+":"+courseA] {
		t.Fatalf("in-progress, foreign-student, or foundation progress leaked: %#v", got)
	}
	other, err := repo.CompletedStudyPlanLessons(ctx, otherStudent, refs)
	if err != nil {
		t.Fatal(err)
	}
	if len(other) != 1 || !other[lessonB+":"+courseA] {
		t.Fatalf("student scope leaked: %#v", other)
	}
	empty, err := repo.CompletedStudyPlanLessons(ctx, student, nil)
	if err != nil || len(empty) != 0 {
		t.Fatalf("empty references should not query or return progress: %#v %v", empty, err)
	}
}


// Round-trip a student's video position and explicit completion through the
// actual Go repository and PostgreSQL transaction paths. Temporary tables
// copy migrated defaults and indexes, so no production/student data is touched.
func TestStudyPlanCompletionReadAfterWritePostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, stop := context.WithTimeout(context.Background(), 30*time.Second)
	defer stop()
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
	for _, table := range []string{"lesson_progress", "lesson_video_progress"} {
		if _, err = db.Exec(ctx, "CREATE TEMP TABLE "+table+" (LIKE public."+table+" INCLUDING ALL)"); err != nil {
			t.Fatalf("migrated %s shape unavailable: %v", table, err)
		}
	}

	const student = "00000000-0000-0000-0000-000000000501"
	const other = "00000000-0000-0000-0000-000000000502"
	const lesson = "00000000-0000-0000-0000-000000000503"
	const course = "00000000-0000-0000-0000-000000000504"
	const otherCourse = "00000000-0000-0000-0000-000000000505"
	repo := New(db)
	if _, err = repo.GetLessonProgress(ctx, student, lesson, learning.LessonProgressCourse, course, ""); !errors.Is(err, learning.ErrNotFound) {
		t.Fatalf("unstarted lesson must not create progress: %v", err)
	}
	saved, err := repo.SaveVideoProgress(ctx, student, lesson, learning.LessonProgressCourse, course, "", 37)
	if err != nil || saved.Status != learning.LessonInProgress || saved.PositionSeconds != 37 {
		t.Fatalf("video save failed or auto-completed: %#v %v", saved, err)
	}
	refs := []learning.StudyPlanLessonRef{{LessonID: lesson, CourseID: course}, {LessonID: lesson, CourseID: otherCourse}}
	before, err := repo.CompletedStudyPlanLessons(ctx, student, refs)
	if err != nil || len(before) != 0 {
		t.Fatalf("watching must not mark a plan task completed: %#v %v", before, err)
	}
	completed, err := repo.CompleteLesson(ctx, student, lesson, learning.LessonProgressCourse, course, "")
	if err != nil || completed.Status != learning.LessonCompleted || completed.CompletedAt == nil || completed.PositionSeconds != 37 {
		t.Fatalf("explicit completion must preserve position: %#v %v", completed, err)
	}
	reloaded, err := repo.GetLessonProgress(ctx, student, lesson, learning.LessonProgressCourse, course, "")
	if err != nil || reloaded.Status != learning.LessonCompleted || reloaded.PositionSeconds != 37 {
		t.Fatalf("completion did not survive repository reload: %#v %v", reloaded, err)
	}
	planRows, err := repo.CompletedStudyPlanLessons(ctx, student, refs)
	if err != nil || len(planRows) != 1 || !planRows[lesson+":"+course] {
		t.Fatalf("completed lesson not projected into plan: %#v %v", planRows, err)
	}
	foreign, err := repo.CompletedStudyPlanLessons(ctx, other, refs)
	if err != nil || len(foreign) != 0 {
		t.Fatalf("foreign student can see completion: %#v %v", foreign, err)
	}
	again, err := repo.SaveVideoProgress(ctx, student, lesson, learning.LessonProgressCourse, course, "", 62)
	if err != nil || again.Status != learning.LessonCompleted || again.PositionSeconds != 62 {
		t.Fatalf("later video position must not reset completion: %#v %v", again, err)
	}
	idempotent, err := repo.CompleteLesson(ctx, student, lesson, learning.LessonProgressCourse, course, "")
	if err != nil || idempotent.CompletedAt == nil || !idempotent.CompletedAt.Equal(*completed.CompletedAt) {
		t.Fatalf("repeated completion changed its original timestamp: %#v %v", idempotent, err)
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err = repo.SaveVideoProgress(cancelled, student, lesson, learning.LessonProgressCourse, otherCourse, "", 13); err == nil {
		t.Fatal("canceled video save unexpectedly succeeded")
	}
	if _, err = repo.GetLessonProgress(ctx, student, lesson, learning.LessonProgressCourse, otherCourse, ""); !errors.Is(err, learning.ErrNotFound) {
		t.Fatalf("failed write leaked a new course-context row: %v", err)
	}
}
