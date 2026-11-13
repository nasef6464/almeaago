package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	questionapp "github.com/nasef6464/almeaago/internal/questionbank/application"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
	questionhttp "github.com/nasef6464/almeaago/internal/questionbank/transport/http"
)

type sectionAudit struct{}

func (sectionAudit) WriteTx(context.Context, pgx.Tx, operations.AuditEvent) error { return nil }

type sectionTestAuth struct{ user identity.User }

func (a sectionTestAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: a.user}, nil
}

func TestQuestionCreateSectionIsAtomic(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_SELF_SCHEMA_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires isolated local PostgreSQL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("question_create_section_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+quoted); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+quoted+" CASCADE")
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
	files, err := filepath.Glob("../../../../migrations/*.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(files)
	for _, file := range files {
		if strings.Compare(filepath.Base(file), "000059_") >= 0 {
			continue
		}
		sql, e := os.ReadFile(file)
		if e != nil {
			t.Fatal(e)
		}
		if _, e = db.Exec(ctx, string(sql)); e != nil {
			t.Fatalf("migration %s: %v", file, e)
		}
	}
	_, err = db.Exec(ctx, `INSERT INTO users(id,email,name,password_hash) VALUES ('00000000-0000-0000-0000-000000000001','section-admin@example.invalid','admin','test');
	INSERT INTO paths(id,code,name) VALUES ('00000000-0000-0000-0000-000000000002','P','path');
	INSERT INTO subjects(id,path_id,code,name) VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','S1','subject'),('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','S2','other');
	INSERT INTO skills(id,subject_id,code,name,kind) VALUES ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000003','SK','skill','main');
	INSERT INTO taxonomy_skill_sections(id,subject_id,name) VALUES ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000003','section'),('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000004','other');`)
	if err != nil {
		t.Fatal(err)
	}
	correct := 0
	links := []question.SkillLink{{SkillID: "00000000-0000-0000-0000-000000000005", RelationType: question.RelationMain}}
	cmd := question.CreateCommand{QuestionCode: "Q-SECTION-ATOMIC", PathID: "00000000-0000-0000-0000-000000000002", SubjectID: "00000000-0000-0000-0000-000000000003", SectionID: "00000000-0000-0000-0000-000000000007", OwnerType: question.OwnerPlatform, SkillLinks: links, Version: question.VersionCommand{QuestionType: question.QuestionMCQ, TextContent: "question", CorrectOptionIndex: &correct, SourceMeta: json.RawMessage(`{}`), AIContext: json.RawMessage(`{}`), VoiceExplanation: json.RawMessage(`{}`), Options: []question.Option{{Index: 0, Text: "yes"}, {Index: 1, Text: "no"}}, SkillLinks: links}}
	repo := New(db, sectionAudit{})
	if _, err = repo.Create(ctx, "00000000-0000-0000-0000-000000000001", cmd); !errors.Is(err, question.ErrInvalidTaxonomy) {
		t.Fatalf("other subject: %v", err)
	}
	var count int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM questions WHERE question_code=$1`, cmd.QuestionCode).Scan(&count); err != nil || count != 0 {
		t.Fatalf("failed create left question: %d %v", count, err)
	}
	cmd.SectionID = "00000000-0000-0000-0000-000000000006"
	created, err := repo.Create(ctx, "00000000-0000-0000-0000-000000000001", cmd)
	if err != nil {
		t.Fatal(err)
	}
	if got, e := repo.GetQuestionSection(ctx, created.ID); e != nil || got != cmd.SectionID {
		t.Fatalf("created section: %q %v", got, e)
	}
	cmd.QuestionCode = "Q-SECTION-NO-AUDIT"
	if _, err = New(db, nil).Create(ctx, "00000000-0000-0000-0000-000000000001", cmd); err == nil {
		t.Fatal("create without audit succeeded")
	}
	if err = db.QueryRow(ctx, `SELECT count(*) FROM questions WHERE question_code=$1`, cmd.QuestionCode).Scan(&count); err != nil || count != 0 {
		t.Fatalf("audit failure left question: %d %v", count, err)
	}
}
func (sectionTestAuth) VerifyCSRF(_ identityapp.Authenticated, token string) error {
	if token != "test-csrf" {
		return errors.New("csrf")
	}
	return nil
}

func TestQuestionSectionSameSubjectAndAuditRollback(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_SELF_SCHEMA_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires isolated local PostgreSQL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("question_section_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
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
	_, err = db.Exec(ctx, `CREATE FUNCTION uuidv7() RETURNS uuid LANGUAGE SQL VOLATILE AS 'SELECT gen_random_uuid()';
	CREATE TABLE subjects(id uuid PRIMARY KEY);
	CREATE TABLE skills(id uuid PRIMARY KEY,subject_id uuid NOT NULL,kind text NOT NULL);
	CREATE TABLE questions(id uuid PRIMARY KEY,subject_id uuid,updated_at timestamptz NOT NULL DEFAULT now());
	INSERT INTO subjects VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
	INSERT INTO questions(id,subject_id) VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001');`)
	if err != nil {
		t.Fatal(err)
	}
	up, err := os.ReadFile("../../../../migrations/000056_taxonomy_skill_sections.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(up)); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, `INSERT INTO taxonomy_skill_sections(id,subject_id,name,status) VALUES
	('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','الأعداد','active'),
	('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','مادة أخرى','active'),
	('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','مؤرشف','archived')`)
	if err != nil {
		t.Fatal(err)
	}
	repo := New(db, sectionAudit{})
	qid, actor, section := "00000000-0000-0000-0000-000000000003", "00000000-0000-0000-0000-000000000099", "00000000-0000-0000-0000-000000000004"
	if err = repo.SetQuestionSection(ctx, actor, qid, section); err != nil {
		t.Fatal(err)
	}
	if got, e := repo.GetQuestionSection(ctx, qid); e != nil || got != section {
		t.Fatalf("read: %q %v", got, e)
	}
	for _, invalid := range []string{"00000000-0000-0000-0000-000000000005", "00000000-0000-0000-0000-000000000006"} {
		if e := repo.SetQuestionSection(ctx, actor, qid, invalid); !errors.Is(e, question.ErrInvalidTaxonomy) {
			t.Fatalf("invalid section: %v", e)
		}
	}
	if err = New(db, nil).SetQuestionSection(ctx, actor, qid, ""); err == nil {
		t.Fatal("write without audit succeeded")
	}
	if got, e := repo.GetQuestionSection(ctx, qid); e != nil || got != section {
		t.Fatalf("rollback: %q %v", got, e)
	}
	if err = repo.SetQuestionSection(ctx, actor, qid, ""); err != nil {
		t.Fatal(err)
	}
	if got, e := repo.GetQuestionSection(ctx, qid); e != nil || got != "" {
		t.Fatalf("clear: %q %v", got, e)
	}
	adminUser := identity.User{ID: actor, Roles: []identity.Role{identity.RoleAdmin}}
	student := identity.User{ID: actor, Roles: []identity.Role{identity.RoleStudent}}
	call := func(user identity.User, method, body, csrf string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, "/"+qid+"/section", strings.NewReader(body))
		req.Header.Set("X-CSRF-Token", csrf)
		out := httptest.NewRecorder()
		questionhttp.New(questionapp.NewService(repo), sectionTestAuth{user: user}).ServeHTTP(out, req)
		return out
	}
	if out := call(adminUser, http.MethodPut, `{"sectionId":"`+section+`"}`, "bad"); out.Code != http.StatusForbidden {
		t.Fatalf("csrf http: %d", out.Code)
	}
	if out := call(student, http.MethodGet, "", ""); out.Code != http.StatusForbidden {
		t.Fatalf("student http: %d", out.Code)
	}
	if out := call(adminUser, http.MethodPut, `{"sectionId":"`+section+`"}`, "test-csrf"); out.Code != http.StatusOK {
		t.Fatalf("save http: %d %s", out.Code, out.Body.String())
	}
	if out := call(adminUser, http.MethodGet, "", ""); out.Code != http.StatusOK || !strings.Contains(out.Body.String(), section) {
		t.Fatalf("read http: %d %s", out.Code, out.Body.String())
	}
}
