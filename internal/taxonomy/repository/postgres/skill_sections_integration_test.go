package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSkillSectionsMigrationIsolationAndRollback(t *testing.T) {
	dsn := os.Getenv("TAXONOMY_SECTION_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TAXONOMY_SECTION_TEST_DATABASE_URL requires disposable local PostgreSQL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("skill_sections_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	_, err = db.Exec(ctx, `CREATE TABLE subjects(id uuid PRIMARY KEY);
		CREATE TABLE skills(id uuid PRIMARY KEY,subject_id uuid NOT NULL REFERENCES subjects(id),kind text NOT NULL);
		CREATE TABLE questions(id uuid PRIMARY KEY,subject_id uuid REFERENCES subjects(id));
		INSERT INTO subjects VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
		INSERT INTO skills VALUES ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','main'),('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','sub');
		INSERT INTO questions VALUES ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000021',NULL);`)
	if err != nil {
		t.Fatal(err)
	}
	up, err := os.ReadFile("../../../../migrations/000056_taxonomy_skill_sections.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	down, err := os.ReadFile("../../../../migrations/000056_taxonomy_skill_sections.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(up)); err != nil {
		t.Fatal(err)
	}
	section := "00000000-0000-0000-0000-000000000030"
	if _, err = db.Exec(ctx, `INSERT INTO taxonomy_skill_sections(id,subject_id,legacy_id,name) VALUES ($1,'00000000-0000-0000-0000-000000000001','legacy-a','section')`, section); err != nil {
		t.Fatal(err)
	}
	for _, sql := range []string{
		`UPDATE skills SET section_id=$1 WHERE id='00000000-0000-0000-0000-000000000010'`,
		`UPDATE questions SET section_id=$1 WHERE id='00000000-0000-0000-0000-000000000020'`,
	} {
		if _, err = db.Exec(ctx, sql, section); err != nil {
			t.Fatal(err)
		}
	}
	for _, sql := range []string{
		`UPDATE skills SET section_id=$1 WHERE id='00000000-0000-0000-0000-000000000011'`,
		`UPDATE questions SET section_id=$1 WHERE id='00000000-0000-0000-0000-000000000021'`,
		`UPDATE questions SET subject_id='00000000-0000-0000-0000-000000000002' WHERE id='00000000-0000-0000-0000-000000000020' AND $1::uuid IS NOT NULL`,
	} {
		if _, err = db.Exec(ctx, sql, section); err == nil {
			t.Fatalf("invalid association accepted: %s", sql)
		}
	}
	if _, err = db.Exec(ctx, string(down)); err == nil {
		t.Fatal("rollback erased populated taxonomy")
	}
	if _, err = db.Exec(ctx, `UPDATE skills SET section_id=NULL; UPDATE questions SET section_id=NULL; DELETE FROM taxonomy_skill_sections`); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(down)); err != nil {
		t.Fatal(err)
	}
}
