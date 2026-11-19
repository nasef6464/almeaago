package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	contentpg "github.com/nasef6464/almeaago/internal/content/repository/postgres"
)

func TestSubjectAccessGuidePostgresDoesNotTruncateOrMixScopes(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_ATTEMPT_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires disposable local PostgreSQL")
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
CREATE TEMP TABLE foundation_topics(id uuid,parent_topic_id uuid,path_id uuid,subject_id uuid,status text,is_visible bool,is_locked bool);
CREATE TEMP TABLE library_items(path_id uuid,subject_id uuid,workflow_status text,is_visible bool,is_locked bool);
CREATE TEMP TABLE assessments(id uuid,workflow_status text,is_published bool,is_visible bool);
CREATE TEMP TABLE assessment_versions(assessment_id uuid,version int,access_type text,assessment_kind text);
CREATE TEMP TABLE assessment_learning_placements(assessment_id uuid,assessment_version int,path_id uuid,subject_id uuid,slot text,access_type text,is_visible bool);
INSERT INTO foundation_topics SELECT md5('root-'||n::text)::uuid,NULL,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','active',true,false FROM generate_series(1,55) n;
INSERT INTO foundation_topics VALUES
 ('00000000-0000-0000-0000-000000000101',NULL,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','active',true,true),
 ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','active',true,false),
 ('00000000-0000-0000-0000-000000000103',NULL,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','active',false,true),
 ('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','active',true,false),
 ('00000000-0000-0000-0000-000000000105',NULL,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','active',true,true),
 ('00000000-0000-0000-0000-000000000106','00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','active',true,false),
 ('00000000-0000-0000-0000-000000000107','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','active',true,false),
 ('00000000-0000-0000-0000-000000000108',NULL,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','inactive',true,true),
 ('00000000-0000-0000-0000-000000000109','00000000-0000-0000-0000-000000000108','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','active',true,false);
INSERT INTO library_items VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','approved',true,true),('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','draft',true,false);
INSERT INTO assessments VALUES ('00000000-0000-0000-0000-000000000010','approved',true,true),('00000000-0000-0000-0000-000000000011','approved',false,true);
INSERT INTO assessment_versions VALUES ('00000000-0000-0000-0000-000000000010',1,'free','normal'),('00000000-0000-0000-0000-000000000011',1,'private','normal');
INSERT INTO assessment_learning_placements SELECT '00000000-0000-0000-0000-000000000010',1,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','training','free',true FROM generate_series(1,55);
INSERT INTO assessment_learning_placements VALUES ('00000000-0000-0000-0000-000000000010',1,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','tests','package',true),('00000000-0000-0000-0000-000000000011',1,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','tests','inherit',true),('00000000-0000-0000-0000-000000000010',1,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','tests','inherit',true);
`)
	if err != nil {
		t.Fatal(err)
	}
	path, subject := "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"
	counts, err := contentpg.New(db, nil).CountSubjectAccessContent(ctx, path, subject)
	if err != nil || counts.FoundationFree != 56 || counts.FoundationPaid != 1 || counts.LibraryPaid != 1 || counts.LibraryFree != 0 {
		t.Fatalf("content=%+v err=%v", counts, err)
	}
	groups, err := New(db, nil).ListSubjectGuidePlacementGroups(ctx, path, subject)
	if err != nil || len(groups) != 2 {
		t.Fatalf("groups=%+v err=%v", groups, err)
	}
}
