package questionhttp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	questionapp "github.com/nasef6464/almeaago/internal/questionbank/application"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
	questionpg "github.com/nasef6464/almeaago/internal/questionbank/repository/postgres"
)

// This verifies HTTP decoding, domain normalization, transactional persistence,
// and staff reload against the real schema. Authentication is deliberately a
// stub; browser authoring and real session/CSRF certification are separate gates.
func TestAuthoringAnswerPersistenceHTTPPostgres(t *testing.T) {
	if os.Getenv("QUESTIONBANK_PERSISTENCE_DB_TEST") != "1" || os.Getenv("DATABASE_URL") == "" {
		t.Skip("QUESTIONBANK_PERSISTENCE_DB_TEST=1 and isolated DATABASE_URL required")
	}
	dsn, err := url.Parse(os.Getenv("DATABASE_URL"))
	if err != nil || dsn.Hostname() != "127.0.0.1" || dsn.Port() != "55439" || dsn.Path != "/almeaa_owner_verify_20261101" || dsn.RawQuery != "sslmode=disable" {
		t.Fatal("refusing database outside the dedicated loopback verification instance")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn.String())
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("question_authoring_%d", time.Now().UnixNano())
	quotedSchema := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+quotedSchema); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanup, stop := context.WithTimeout(context.Background(), 15*time.Second)
		defer stop()
		if _, err := admin.Exec(cleanup, "DROP SCHEMA "+quotedSchema+" CASCADE"); err != nil {
			t.Errorf("clean isolated schema: %v", err)
		}
	}()
	cfg, err := pgxpool.ParseConfig(dsn.String())
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	cfg.MaxConns = 2
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Apply production migration files to our own schema rather than constructing
	// reduced lookalike tables which would omit the real constraints and indexes.
	_, sourceFile, _, _ := runtime.Caller(0)
	migrationDir := filepath.Join(filepath.Dir(sourceFile), "..", "..", "..", "..", "migrations")
	files, err := filepath.Glob(filepath.Join(migrationDir, "*.up.sql"))
	if err != nil || len(files) == 0 {
		t.Fatalf("find migrations: count=%d err=%v", len(files), err)
	}
	for _, file := range files {
		raw, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(ctx, string(raw)); err != nil {
			t.Fatalf("apply %s: %v", filepath.Base(file), err)
		}
	}
	const actorID = "10000000-0000-4000-8000-000000000001"
	const pathID = "10000000-0000-4000-8000-000000000002"
	const subjectID = "10000000-0000-4000-8000-000000000003"
	const mainID = "10000000-0000-4000-8000-000000000004"
	const subID = "10000000-0000-4000-8000-000000000005"
	const assetID = "10000000-0000-4000-8000-000000000006"
	if _, err := db.Exec(ctx, `
		INSERT INTO users(id,email,name,password_hash) VALUES ('10000000-0000-4000-8000-000000000001','authoring@example.invalid','Authoring test','not-a-login-hash');
		INSERT INTO paths(id,code,name) VALUES ('10000000-0000-4000-8000-000000000002','VERIFY-PATH','Verification path');
		INSERT INTO subjects(id,path_id,code,name) VALUES ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','VERIFY-SUBJECT','Verification subject');
		INSERT INTO skills(id,subject_id,code,name,kind) VALUES ('10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003','VERIFY-MAIN','Verification main','main');
		INSERT INTO skills(id,subject_id,parent_skill_id,code,name,kind) VALUES ('10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004','VERIFY-SUB','Verification sub','sub');
		INSERT INTO assets(id,object_key,mime_type,size_bytes,status) VALUES ('10000000-0000-4000-8000-000000000006','verification/embedded-question.webp','image/webp',1,'active');
	`); err != nil {
		t.Fatal(err)
	}
	service := questionapp.NewService(questionpg.New(db, operationspg.NewAuditWriter()))
	handler := New(service, authStub{auth: identityapp.Authenticated{User: identity.User{ID: actorID, Roles: []identity.Role{identity.RoleAdmin}}}})

	for _, tc := range []struct {
		name        string
		answerIndex int
		embedded    bool
	}{
		{name: "correct_index_0", answerIndex: 0},
		{name: "correct_index_1", answerIndex: 1},
		{name: "embedded_correct_index_3", answerIndex: 3, embedded: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			answerIndex := tc.answerIndex
			code := "VERIFY-ANSWER-" + tc.name
			input := questionapp.CreateInput{QuestionCode: code, Version: questionapp.VersionInput{
				PathID: pathID, SubjectID: subjectID, QuestionType: question.QuestionMCQ,
				TextContent: "اختر الإجابة الصحيحة", CorrectOptionIndex: &answerIndex,
				Options:    []questionapp.OptionInput{{Text: "الخيار الأول"}, {Text: "الخيار الثاني"}},
				SkillLinks: []questionapp.SkillLinkInput{{SkillID: mainID, RelationType: question.RelationMain}, {SkillID: subID, RelationType: question.RelationSub}},
			}}
			if tc.embedded {
				input.Version.TextContent = ""
				input.Version.ImageAssetID = assetID
				input.Version.ImageAlt = "سؤال مصور بأربعة اختيارات"
				input.Version.OptionsEmbeddedInImage = true
				input.Version.Options = []questionapp.OptionInput{{Text: "أ"}, {Text: "قيمة ب"}, {Text: "ج"}, {Text: "قيمة د"}}
				input.Version.AIContext = json.RawMessage(`{"optionTexts":["أ","قيمة ب","ج","قيمة د"]}`)
			}
			raw, err := json.Marshal(input)
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(raw)).WithContext(ctx)
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != http.StatusCreated {
				t.Fatalf("create: status=%d body=%s", response.Code, response.Body.String())
			}
			var created struct {
				Question struct {
					ID string `json:"id"`
				} `json:"question"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil || created.Question.ID == "" {
				t.Fatalf("decode created question: %v body=%s", err, response.Body.String())
			}
			var storedIndex int
			var storedText string
			if err := db.QueryRow(ctx, `SELECT qv.correct_option_index,qo.option_text FROM question_versions qv JOIN question_options qo ON qo.question_id=qv.question_id AND qo.version=qv.version AND qo.option_index=qv.correct_option_index WHERE qv.question_id=$1::uuid AND qv.version=1`, created.Question.ID).Scan(&storedIndex, &storedText); err != nil {
				t.Fatal(err)
			}
			if storedIndex != answerIndex || storedText != input.Version.Options[answerIndex].Text {
				t.Fatalf("wrong persisted answer: index=%d text=%q", storedIndex, storedText)
			}
			var storedOptionCount int
			if err := db.QueryRow(ctx, `SELECT count(*) FROM question_options WHERE question_id=$1::uuid AND version=1`, created.Question.ID).Scan(&storedOptionCount); err != nil || storedOptionCount != len(input.Version.Options) {
				t.Fatalf("persisted option count=%d want=%d err=%v", storedOptionCount, len(input.Version.Options), err)
			}
			reloaded := httptest.NewRecorder()
			handler.ServeHTTP(reloaded, httptest.NewRequest(http.MethodGet, "/"+created.Question.ID+"/staff", nil).WithContext(ctx))
			var detail struct {
				Question struct {
					Version struct {
						CorrectOptionIndex *int `json:"correctOptionIndex"`
						AIContext          struct {
							OptionTexts []string `json:"optionTexts"`
						} `json:"aiContext"`
					} `json:"version"`
					Options []struct {
						Index int    `json:"index"`
						Text  string `json:"text"`
					} `json:"options"`
				} `json:"question"`
			}
			if reloaded.Code != http.StatusOK {
				t.Fatalf("reload: status=%d body=%s", reloaded.Code, reloaded.Body.String())
			}
			if err := json.Unmarshal(reloaded.Body.Bytes(), &detail); err != nil {
				t.Fatal(err)
			}
			if detail.Question.Version.CorrectOptionIndex == nil || *detail.Question.Version.CorrectOptionIndex != answerIndex || len(detail.Question.Options) != len(input.Version.Options) {
				t.Fatalf("reload lost answer/options: %s", reloaded.Body.String())
			}
			for i, option := range detail.Question.Options {
				if option.Index != i || option.Text != input.Version.Options[i].Text {
					t.Fatalf("reload changed option order: %s", reloaded.Body.String())
				}
				if tc.embedded && (len(detail.Question.Version.AIContext.OptionTexts) != len(detail.Question.Options) || detail.Question.Version.AIContext.OptionTexts[i] != option.Text) {
					t.Fatalf("embedded accessible labels no longer match stored choices: %s", reloaded.Body.String())
				}
			}
			var audits int
			if err := db.QueryRow(ctx, `SELECT count(*) FROM audit_logs WHERE resource_id=$1 AND action='questionbank.question.create'`, created.Question.ID).Scan(&audits); err != nil || audits != 1 {
				t.Fatalf("transactional audit: count=%d err=%v", audits, err)
			}
		})
	}
	t.Run("invalid_answer_does_not_persist", func(t *testing.T) {
		body := fmt.Sprintf(`{"questionCode":"VERIFY-INVALID","version":{"pathId":%q,"subjectId":%q,"type":"mcq","text":"invalid answer","correctOptionIndex":2,"options":[{"text":"first"},{"text":"second"}],"skillLinks":[{"skillId":%q,"relationType":"main"},{"skillId":%q,"relationType":"sub"}]}}`, pathID, subjectID, mainID, subID)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)).WithContext(ctx))
		if response.Code != http.StatusBadRequest {
			t.Fatalf("invalid answer: status=%d body=%s", response.Code, response.Body.String())
		}
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM questions WHERE question_code='VERIFY-INVALID'`).Scan(&count); err != nil || count != 0 {
			t.Fatalf("invalid question persisted: count=%d err=%v", count, err)
		}
	})
}
