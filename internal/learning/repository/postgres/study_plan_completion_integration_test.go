package postgres

import (
	"context"
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
