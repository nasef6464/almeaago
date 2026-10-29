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

// TestFoundationParentCycleConcurrentPostgres reproduces two admins reparenting
// independent foundation topics into each other. Both requests may validate
// against the same old tree unless validation serializes per subject.
func TestFoundationParentCycleConcurrentPostgres(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("requires isolated DATABASE_URL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	defer cancel()

	admin, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	schema := fmt.Sprintf("foundation_parent_cycle_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	})

	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	cfg.MaxConns = 4
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	_, err = db.Exec(ctx, `CREATE TABLE foundation_topics (
		id uuid PRIMARY KEY,
		path_id uuid NOT NULL,
		subject_id uuid NOT NULL,
		parent_topic_id uuid,
		status text NOT NULL
	)`)
	if err != nil {
		t.Fatal(err)
	}

	const pathID = "01900000-0000-7000-8000-000000000101"
	const subjectID = "01900000-0000-7000-8000-000000000102"
	const firstID = "01900000-0000-7000-8000-000000000103"
	const secondID = "01900000-0000-7000-8000-000000000104"
	const archivedID = "01900000-0000-7000-8000-000000000105"
	const otherSubjectID = "01900000-0000-7000-8000-000000000106"
	const foreignID = "01900000-0000-7000-8000-000000000107"
	for _, item := range []struct{ id, subject, status string }{
		{firstID, subjectID, "active"},
		{secondID, subjectID, "active"},
		{archivedID, subjectID, "archived"},
		{foreignID, otherSubjectID, "active"},
	} {
		if _, err := db.Exec(ctx, `INSERT INTO foundation_topics(id,path_id,subject_id,status)
			VALUES($1::uuid,$2::uuid,$3::uuid,$4)`, item.id, pathID, item.subject, item.status); err != nil {
			t.Fatal(err)
		}
	}

	t.Run("scope and archived parent are rejected", func(t *testing.T) {
		tx, err := db.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		for _, parent := range []string{firstID, archivedID, foreignID} {
			topic := firstID
			if parent == firstID {
				topic = firstID // self-parent
			}
			if err := validateTopicParentTx(ctx, tx, topic, parent, pathID, subjectID); !errors.Is(err, content.ErrConflict) {
				t.Fatalf("parent %s: expected conflict, got %v", parent, err)
			}
		}
	})

	firstTx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer firstTx.Rollback(ctx)
	if err := validateTopicParentTx(ctx, firstTx, firstID, secondID, pathID, subjectID); err != nil {
		t.Fatal(err)
	}

	attempted := make(chan struct{})
	secondResult := make(chan error, 1)
	go func() {
		tx, err := db.Begin(ctx)
		if err != nil {
			secondResult <- err
			return
		}
		defer tx.Rollback(ctx)
		close(attempted)
		if err := validateTopicParentTx(ctx, tx, secondID, firstID, pathID, subjectID); err != nil {
			secondResult <- err
			return
		}
		if _, err := tx.Exec(ctx, `UPDATE foundation_topics SET parent_topic_id=$2::uuid WHERE id=$1::uuid`, secondID, firstID); err != nil {
			secondResult <- err
			return
		}
		secondResult <- tx.Commit(ctx)
	}()
	<-attempted
	// Before the fix, the second transaction validates the unchanged tree here.
	// With the fix it waits for the first transaction's per-subject lock.
	time.Sleep(200 * time.Millisecond)
	if _, err := firstTx.Exec(ctx, `UPDATE foundation_topics SET parent_topic_id=$2::uuid WHERE id=$1::uuid`, firstID, secondID); err != nil {
		t.Fatal(err)
	}
	if err := firstTx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if err := <-secondResult; !errors.Is(err, content.ErrConflict) {
		t.Fatalf("concurrent reciprocal reparent must be rejected, got %v", err)
	}
	var cycle bool
	if err := db.QueryRow(ctx, `SELECT a.parent_topic_id=b.id AND b.parent_topic_id=a.id
		FROM foundation_topics a JOIN foundation_topics b ON b.id=$2::uuid
		WHERE a.id=$1::uuid`, firstID, secondID).Scan(&cycle); err != nil {
		t.Fatal(err)
	}
	if cycle {
		t.Fatal("foundation topic parent cycle persisted")
	}
}
