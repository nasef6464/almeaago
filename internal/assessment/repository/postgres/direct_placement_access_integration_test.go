package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestDirectPlacementAccessContextsPostgres(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_ATTEMPT_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("use disposable local PostgreSQL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
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
	_, err = db.Exec(ctx, `
CREATE TEMP TABLE paths(id uuid,parent_path_id uuid,status text,presentation jsonb);
CREATE TEMP TABLE subjects(id uuid,path_id uuid,status text,presentation jsonb,level_id uuid);
CREATE TEMP TABLE levels(id uuid,path_id uuid,status text,presentation jsonb);
CREATE TEMP TABLE assessments(id uuid,published_version int,workflow_status text,is_published bool,is_visible bool);
CREATE TEMP TABLE assessment_versions(assessment_id uuid,version int,assessment_kind text,access_type text);
CREATE TEMP TABLE assessment_learning_placements(id uuid,assessment_id uuid,assessment_version int,slot text,access_type text,path_id uuid,subject_id uuid,course_id uuid,is_visible bool,sort_order int);
INSERT INTO paths VALUES ('00000000-0000-0000-0000-000000000001',NULL,'active','{}');
INSERT INTO subjects VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','active','{}',NULL);
INSERT INTO assessments VALUES ('00000000-0000-0000-0000-000000000003',2,'approved',true,true);
INSERT INTO assessment_versions VALUES ('00000000-0000-0000-0000-000000000003',1,'normal','free'),('00000000-0000-0000-0000-000000000003',2,'normal','free');
INSERT INTO assessment_learning_placements VALUES
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000003',1,'training','free','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',NULL,true,1),
 ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000003',2,'tests','package','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',NULL,true,2),
 ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000003',2,'training','free','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',NULL,false,3),
 ('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000003',2,'course','free','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',NULL,true,4);`)
	if err != nil {
		t.Fatal(err)
	}
	repo := New(db, nil)
	const id = "00000000-0000-0000-0000-000000000003"
	has, scopes, err := repo.DirectPlacementAccessContexts(ctx, id)
	if err != nil || !has || len(scopes) != 1 || scopes[0].PlacementID != "00000000-0000-0000-0000-000000000012" {
		t.Fatalf("unexpected current visible scopes: has=%v scopes=%+v err=%v", has, scopes, err)
	}
	if _, err = db.Exec(ctx, `UPDATE paths SET presentation='{"isVisible":false}'`); err != nil {
		t.Fatal(err)
	}
	has, scopes, err = repo.DirectPlacementAccessContexts(ctx, id)
	if err != nil || !has || len(scopes) != 0 {
		t.Fatalf("hidden path granted access: has=%v scopes=%+v err=%v", has, scopes, err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM assessment_learning_placements`); err != nil {
		t.Fatal(err)
	}
	has, scopes, err = repo.DirectPlacementAccessContexts(ctx, id)
	if err != nil || has || len(scopes) != 0 {
		t.Fatalf("standalone assessment: has=%v scopes=%+v err=%v", has, scopes, err)
	}
}
