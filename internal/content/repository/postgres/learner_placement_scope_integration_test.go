package postgres

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	content "github.com/nasef6464/almeaago/internal/content/domain"
)

// This test uses a disposable schema and intentionally inconsistent placements.
// An admin can change a content item's taxonomy after it has been linked; the
// learner must never receive a placement from another path/subject.
func TestLearnerPlacementScopePostgres(t *testing.T) {
	if os.Getenv("CONTENT_SCOPE_DB_TEST") != "1" || os.Getenv("DATABASE_URL") == "" {
		t.Skip("CONTENT_SCOPE_DB_TEST=1 and isolated DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	admin, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("content_scope_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer func() {
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	}()
	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.MaxConns = 2
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	ddl := []string{
		`CREATE TABLE assets (id uuid PRIMARY KEY, status text)`,
		`CREATE TABLE courses (
			id uuid PRIMARY KEY, path_id uuid, subject_id uuid,
			title text, description text, instructor_name text, duration_minutes int,
			level text, thumbnail_asset_id uuid, drip_content_enabled bool,
			certificate_enabled bool, workflow_status text, is_published bool, is_visible bool)`,
		`CREATE TABLE course_modules (
			id uuid PRIMARY KEY, course_id uuid, status text,
			sort_order int, title text, description text)`,
		`CREATE TABLE lessons (
			id uuid PRIMARY KEY, path_id uuid, subject_id uuid,
			title text, description text, lesson_type text, duration_seconds int,
			is_locked bool, workflow_status text, is_visible bool,
			content_text text, video_url text, video_source text)`,
		`CREATE TABLE course_lessons (
			module_id uuid, lesson_id uuid, is_preview bool, sort_order int)`,
		`CREATE TABLE foundation_topics (
			id uuid PRIMARY KEY, path_id uuid, subject_id uuid, parent_topic_id uuid,
			title text, description text, sort_order int, is_locked bool,
			status text, is_visible bool)`,
		`CREATE TABLE topic_lessons (topic_id uuid, lesson_id uuid, sort_order int)`,
		`CREATE TABLE library_items (
			id uuid PRIMARY KEY, path_id uuid, subject_id uuid,
			title text, description text, item_type text, is_locked bool,
			workflow_status text, is_visible bool)`,
		`CREATE TABLE topic_library_items (
			topic_id uuid, library_item_id uuid, sort_order int)`,
	}
	for _, sql := range ddl {
		if _, err := db.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	const (
		pathID = "01900000-0000-7000-8000-000000001001"
		subjectID = "01900000-0000-7000-8000-000000002001"
		otherSubjectID = "01900000-0000-7000-8000-000000002002"
		courseID = "01900000-0000-7000-8000-000000003001"
		moduleID = "01900000-0000-7000-8000-000000003002"
		allowedLessonID = "01900000-0000-7000-8000-000000004001"
		foreignLessonID = "01900000-0000-7000-8000-000000004002"
		topicID = "01900000-0000-7000-8000-000000005001"
		allowedLibraryID = "01900000-0000-7000-8000-000000006001"
		foreignLibraryID = "01900000-0000-7000-8000-000000006002"
	)
	inserts := []struct {
		sql string
		args []any
	}{
		{`INSERT INTO courses VALUES($1,$2,$3,'course','','teacher',30,'beginner',NULL,false,false,'approved',true,true)`, []any{courseID,pathID,subjectID}},
		{`INSERT INTO course_modules VALUES($1,$2,'active',0,'module','')`, []any{moduleID,courseID}},
		{`INSERT INTO lessons VALUES($1,$2,$3,$4,'','video',60,false,'approved',true,'body','','')`, []any{allowedLessonID,pathID,subjectID,"allowed"}},
		{`INSERT INTO lessons VALUES($1,$2,$3,$4,'','video',60,false,'approved',true,'body','','')`, []any{foreignLessonID,pathID,otherSubjectID,"foreign"}},
		{`INSERT INTO course_lessons VALUES($1,$2,true,0),($1,$3,true,1)`, []any{moduleID,allowedLessonID,foreignLessonID}},
		{`INSERT INTO foundation_topics VALUES($1,$2,$3,NULL,'topic','',0,false,'active',true)`, []any{topicID,pathID,subjectID}},
		{`INSERT INTO topic_lessons VALUES($1,$2,0),($1,$3,1)`, []any{topicID,allowedLessonID,foreignLessonID}},
		{`INSERT INTO library_items VALUES($1,$2,$3,$4,'','file',false,'approved',true)`, []any{allowedLibraryID,pathID,subjectID,"allowed"}},
		{`INSERT INTO library_items VALUES($1,$2,$3,$4,'','file',false,'approved',true)`, []any{foreignLibraryID,pathID,otherSubjectID,"foreign"}},
		{`INSERT INTO topic_library_items VALUES($1,$2,0),($1,$3,1)`, []any{topicID,allowedLibraryID,foreignLibraryID}},
	}
	for _, row := range inserts {
		if _, err := db.Exec(ctx, row.sql, row.args...); err != nil {
			t.Fatal(err)
		}
	}

	repo := New(db, nil)
	course, err := repo.GetLearnerCourse(ctx, courseID)
	if err != nil {
		t.Fatal(err)
	}
	if len(course.Modules) != 1 || len(course.Modules[0].Lessons) != 1 ||
		course.Modules[0].Lessons[0].ID != allowedLessonID {
		t.Fatalf("course leaked foreign-subject lesson: %+v", course.Modules)
	}
	if _, err := repo.GetLearnerCourseLesson(ctx, courseID, allowedLessonID); err != nil {
		t.Fatalf("same-subject lesson not accessible: %v", err)
	}
	if _, err := repo.GetLearnerCourseLesson(ctx, courseID, foreignLessonID); !errors.Is(err, content.ErrNotFound) {
		t.Fatalf("foreign-subject course lesson should not be readable: %v", err)
	}
	if ok, _, _, err := repo.ResolveLessonProgressTarget(ctx, "course", courseID, foreignLessonID); err != nil || ok {
		t.Fatalf("foreign-subject course progress target accepted: ok=%v err=%v", ok, err)
	}

	topic, err := repo.GetLearnerTopic(ctx, topicID)
	if err != nil {
		t.Fatal(err)
	}
	if len(topic.Lessons) != 1 || topic.Lessons[0].ID != allowedLessonID ||
		len(topic.LibraryItems) != 1 || topic.LibraryItems[0].ID != allowedLibraryID {
		t.Fatalf("foundation leaked foreign-subject placement: %+v", topic)
	}
	if ok, _, _, err := repo.ResolveLessonProgressTarget(ctx, "foundation", topicID, foreignLessonID); err != nil || ok {
		t.Fatalf("foreign-subject foundation progress target accepted: ok=%v err=%v", ok, err)
	}
}
