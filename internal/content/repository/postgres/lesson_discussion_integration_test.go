package postgres

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	"os"
	"testing"
)

func TestLessonDiscussionPostgresScopeAndIdempotency(t *testing.T) {
	dsn := os.Getenv("LESSON_DISCUSSION_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires isolated PostgreSQL")
	}
	ctx := context.Background()
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
	_, err = db.Exec(ctx, `CREATE TEMP TABLE users(id uuid PRIMARY KEY,name text);
	CREATE TEMP TABLE lesson_discussion_messages(id uuid PRIMARY KEY DEFAULT uuidv7(),course_id uuid NOT NULL,lesson_id uuid NOT NULL,author_id uuid NOT NULL REFERENCES users(id),parent_id uuid REFERENCES lesson_discussion_messages(id),body text NOT NULL,request_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(course_id,lesson_id,author_id,request_id));
	INSERT INTO users VALUES ('00000000-0000-0000-0000-000000000001','student');`)
	if err != nil {
		t.Fatal(err)
	}
	r := New(db, nil)
	author := "00000000-0000-0000-0000-000000000001"
	course := "00000000-0000-0000-0000-000000000002"
	lesson := "00000000-0000-0000-0000-000000000003"
	other := "00000000-0000-0000-0000-000000000004"
	first, err := r.CreateLessonDiscussion(ctx, course, lesson, author, "", "question", "request-123456789")
	if err != nil {
		t.Fatal(err)
	}
	retry, err := r.CreateLessonDiscussion(ctx, course, lesson, author, "", "question", "request-123456789")
	if err != nil || retry.ID != first.ID {
		t.Fatalf("retry: %+v %v", retry, err)
	}
	if _, err = r.CreateLessonDiscussion(ctx, course, lesson, author, "", "changed", "request-123456789"); !errors.Is(err, content.ErrConflict) {
		t.Fatalf("changed retry: %v", err)
	}
	if _, err = r.CreateLessonDiscussion(ctx, course, other, author, first.ID, "cross-scope", "request-987654321"); !errors.Is(err, content.ErrConflict) {
		t.Fatalf("foreign parent: %v", err)
	}
	if _, err = r.CreateLessonDiscussion(ctx, course, lesson, author, first.ID, "answer", "request-987654321"); err != nil {
		t.Fatalf("reply: %v", err)
	}
	page, err := r.ListLessonDiscussion(ctx, course, lesson, 1, 1)
	if err != nil || !page.HasMore || len(page.Items) != 1 {
		t.Fatalf("page: %+v %v", page, err)
	}
	page, err = r.ListLessonDiscussion(ctx, course, other, 1, 30)
	if err != nil || len(page.Items) != 0 {
		t.Fatalf("other lesson: %+v %v", page, err)
	}
}
