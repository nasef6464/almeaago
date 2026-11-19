package postgres

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	contenthttp "github.com/nasef6464/almeaago/internal/content/transport/http"
)

func TestLearnerFoundationPaginationPostgres(t *testing.T) {
	dsn := os.Getenv("COMMERCE_JOURNEY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires disposable local PostgreSQL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.MaxConns = 1
	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	_, err = db.Exec(ctx, `
CREATE TEMP TABLE paths(id uuid,parent_path_id uuid,status text,presentation jsonb);
CREATE TEMP TABLE levels(id uuid,path_id uuid,status text,presentation jsonb);
CREATE TEMP TABLE subjects(id uuid,path_id uuid,level_id uuid,status text,presentation jsonb);
CREATE TEMP TABLE foundation_topics(id uuid,parent_topic_id uuid,path_id uuid,subject_id uuid,title text,description text,sort_order int,is_locked bool,status text,is_visible bool);
INSERT INTO paths VALUES ('00000000-0000-0000-0000-000000000001',NULL,'active','{}');
INSERT INTO subjects VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',NULL,'active','{}');
INSERT INTO foundation_topics SELECT md5('topic-'||n::text)::uuid,NULL,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','topic-'||n::text,'',n,false,'active',true FROM generate_series(1,50) n;
INSERT INTO foundation_topics VALUES
 (md5('topic-51')::uuid,md5('topic-1')::uuid,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','late child','',51,true,'active',true),
 (md5('hidden')::uuid,NULL,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','hidden','',52,false,'active',false),
 (md5('other')::uuid,NULL,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','other','',53,false,'active',true);`)
	if err != nil {
		t.Fatal(err)
	}
	repo := New(db, nil)
	path, subject := "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"
	first, err := repo.ListLearnerFoundationPage(ctx, path, subject, 1, 50)
	if err != nil || len(first.Items) != 50 || !first.HasMore {
		t.Fatalf("first: %+v %v", first, err)
	}
	second, err := repo.ListLearnerFoundationPage(ctx, path, subject, 2, 50)
	if err != nil || len(second.Items) != 1 || second.HasMore || second.Items[0].Title != "late child" || second.Items[0].ParentTopicID != first.Items[0].ID {
		t.Fatalf("second: %+v %v", second, err)
	}
	if _, err := repo.ListLearnerFoundationPage(ctx, path, "00000000-0000-0000-0000-000000000003", 1, 50); err == nil {
		t.Fatal("foreign subject must be rejected")
	}
	handler := contenthttp.NewLearningSpaces(contentapp.NewService(repo), nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/"+path+"/subjects/"+subject+"/foundation?page=2&limit=50", nil))
	if w.Code != http.StatusOK || w.Header().Get("Cache-Control") != "private, no-store" || !strings.Contains(w.Body.String(), `"title":"late child"`) || !strings.Contains(w.Body.String(), `"isFree":false`) {
		t.Fatalf("HTTP page: %d %s", w.Code, w.Body.String())
	}
}
