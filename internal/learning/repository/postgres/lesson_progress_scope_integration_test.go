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

// Same canonical lesson in two courses must have independent video position and
// completion. Session-local tables mirror the migrated constraints without
// inserting any real users, courses, or lesson records.
func TestLessonProgressContextIsolationPostgres(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	config.MaxConns = 1 // temp tables and repository transactions share one session
	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, stmt := range []string{
		"CREATE TEMP TABLE lesson_progress (LIKE public.lesson_progress INCLUDING ALL)",
		"CREATE TEMP TABLE lesson_video_progress (LIKE public.lesson_video_progress INCLUDING ALL)",
	} {
		if _, err := db.Exec(ctx, stmt); err != nil {
			t.Fatal(err)
		}
	}
	const student = "00000000-0000-0000-0000-000000000011"
	const otherStudent = "00000000-0000-0000-0000-000000000012"
	const lessonID = "00000000-0000-0000-0000-000000000013"
	const courseA = "00000000-0000-0000-0000-000000000014"
	const courseB = "00000000-0000-0000-0000-000000000015"
	repo := New(db)

	first, err := repo.SaveVideoProgress(ctx, student, lessonID, learning.LessonProgressCourse, courseA, "", 41)
	if err != nil || first.PositionSeconds != 41 || first.CourseID != courseA || first.Status != learning.LessonInProgress {
		t.Fatalf("course A save: progress=%+v err=%v", first, err)
	}
	second, err := repo.SaveVideoProgress(ctx, student, lessonID, learning.LessonProgressCourse, courseB, "", 77)
	if err != nil || second.PositionSeconds != 77 || second.CourseID != courseB || second.Status != learning.LessonInProgress {
		t.Fatalf("course B save: progress=%+v err=%v", second, err)
	}
	first, err = repo.CompleteLesson(ctx, student, lessonID, learning.LessonProgressCourse, courseA, "")
	if err != nil || first.Status != learning.LessonCompleted || first.PositionSeconds != 41 {
		t.Fatalf("course A completion: progress=%+v err=%v", first, err)
	}
	second, err = repo.GetLessonProgress(ctx, student, lessonID, learning.LessonProgressCourse, courseB, "")
	if err != nil || second.Status != learning.LessonInProgress || second.PositionSeconds != 77 {
		t.Fatalf("course B must remain independent: progress=%+v err=%v", second, err)
	}
	if _, err = repo.GetLessonProgress(ctx, otherStudent, lessonID, learning.LessonProgressCourse, courseA, ""); !errors.Is(err, learning.ErrNotFound) {
		t.Fatalf("other learner must not see course A progress: %v", err)
	}
	if _, err = repo.GetLessonProgress(ctx, student, lessonID, learning.LessonProgressFoundation, "", courseA); !errors.Is(err, learning.ErrNotFound) {
		t.Fatalf("foundation context must not see course A progress: %v", err)
	}
}
