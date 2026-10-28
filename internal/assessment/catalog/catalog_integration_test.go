package catalog

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"testing"
	"time"
)

func TestPublicMockCatalogPostgresVisibilityAndPublishedSnapshot(t *testing.T) {
	if os.Getenv("PUBLIC_MOCKS_TEST_DB") != "1" || os.Getenv("DATABASE_URL") == "" {
		t.Skip("PUBLIC_MOCKS_TEST_DB=1 and isolated migrated DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("public_mock_catalog_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, table := range []string{"paths", "levels", "subjects", "assessments", "assessment_versions", "assessment_sections", "assessment_version_questions"} {
		if _, err = db.Exec(ctx, "CREATE TABLE "+table+" (LIKE public."+table+" INCLUDING ALL)"); err != nil {
			t.Fatal(err)
		}
	}
	var path, hidden, child string
	if err = db.QueryRow(ctx, `INSERT INTO paths(code,name)VALUES('P','Path')RETURNING id::text`).Scan(&path); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO paths(code,name,status)VALUES('H','Hidden','archived')RETURNING id::text`).Scan(&hidden); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO paths(code,name,parent_path_id)VALUES('C','Child',$1::uuid)RETURNING id::text`, hidden).Scan(&child); err != nil {
		t.Fatal(err)
	}
	insert := func(code, owner, workflow, versionStatus, kind, pathID string, published, visible bool) string {
		t.Helper()
		var id string
		err := db.QueryRow(ctx, `INSERT INTO assessments(assessment_code,owner_type,owner_user_id,owner_school_id,workflow_status,is_published,is_visible,published_version,current_version)VALUES($1,$2,CASE WHEN $2='teacher' THEN gen_random_uuid() END,CASE WHEN $2='school' THEN gen_random_uuid() END,$3,$4,$5,1,1)RETURNING id::text`, code, owner, workflow, published, visible).Scan(&id)
		if err != nil {
			t.Fatal(err)
		}
		_, err = db.Exec(ctx, `INSERT INTO assessment_versions(assessment_id,version,title,path_id,assessment_kind,normal_mode,version_status,time_limit_seconds,mock_category,mock_target_score,mock_strict_section_lock,mock_presentation_mode,published_at)VALUES($1::uuid,1,$2,$3::uuid,$4,CASE WHEN $4='normal' THEN 'exam' END,$5,3600,CASE WHEN $4='mock' THEN 'qudrat' END,CASE WHEN $4='mock' THEN 90 END,CASE WHEN $4='mock' THEN true END,CASE WHEN $4='mock' THEN 'qiyas_strict' END,CASE WHEN $5='published' THEN now() END)`, id, code, pathID, kind, versionStatus)
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	wanted := insert("published-snapshot", "platform", "approved", "published", "mock", path, true, true)
	insert("school-private", "school", "approved", "published", "mock", path, true, true)
	insert("teacher-private", "teacher", "approved", "published", "mock", path, true, true)
	insert("unpublished", "platform", "approved", "published", "mock", path, false, true)
	insert("invisible", "platform", "approved", "published", "mock", path, true, false)
	insert("draft", "platform", "draft", "draft", "mock", path, false, true)
	insert("normal", "platform", "approved", "published", "normal", path, true, true)
	insert("hidden-ancestor", "platform", "approved", "published", "mock", child, true, true)
	if _, err = db.Exec(ctx, `UPDATE assessments SET current_version=2 WHERE id=$1::uuid;`, wanted); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO assessment_versions(assessment_id,version,title,path_id,assessment_kind,normal_mode)VALUES($1::uuid,2,'SECRET DRAFT',$2::uuid,'normal','practice')`, wanted, path); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO assessment_sections(assessment_id,assessment_version,title,time_limit_seconds)VALUES($1::uuid,1,'A',600),($1::uuid,1,'B',1200)`, wanted); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO assessment_version_questions(assessment_id,assessment_version,question_id,question_version)VALUES($1::uuid,1,gen_random_uuid(),1),($1::uuid,1,gen_random_uuid(),1)`, wanted); err != nil {
		t.Fatal(err)
	}
	rows, err := NewPostgres(db).ListPublicMocks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].ID != wanted || rows[0].Title != "published-snapshot" || rows[0].QuestionCount != 2 || rows[0].SectionCount != 2 || rows[0].TimeLimitSeconds != 1800 {
		t.Fatalf("unsafe/wrong published catalog: %+v", rows)
	}
}
