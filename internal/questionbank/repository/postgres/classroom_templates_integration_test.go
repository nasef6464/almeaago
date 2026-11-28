package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	questionapp "github.com/nasef6464/almeaago/internal/questionbank/application"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
	questionhttp "github.com/nasef6464/almeaago/internal/questionbank/transport/http"
)

type templateHTTPActor struct{ user identity.User }

func (a templateHTTPActor) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: a.user}, nil
}

func (templateHTTPActor) VerifyCSRF(_ identityapp.Authenticated, token string) error {
	if token != "template-test" {
		return fmt.Errorf("invalid CSRF")
	}
	return nil
}

func TestClassroomTemplateHTTPPersistenceAndIsolationPostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("migrated PostgreSQL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
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
	for _, table := range []string{"users", "schools", "school_memberships", "teaching_assignments", "questions"} {
		if _, err := db.Exec(ctx, "CREATE TEMP TABLE "+table+" AS SELECT * FROM public."+table+" WITH NO DATA"); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(ctx, "CREATE TEMP TABLE audit_logs (LIKE public.audit_logs INCLUDING ALL); CREATE TEMP TABLE classroom_prepared_templates (LIKE public.classroom_prepared_templates INCLUDING ALL)"); err != nil {
		t.Fatal(err)
	}

	const ownSchool = "10000000-0000-4000-8000-000000000001"
	const otherSchool = "10000000-0000-4000-8000-000000000002"
	const teacher = "10000000-0000-4000-8000-000000000003"
	const otherTeacher = "10000000-0000-4000-8000-000000000004"
	const questionID = "10000000-0000-4000-8000-000000000005"
	fixture := fmt.Sprintf(`
		INSERT INTO users(id) VALUES ('%s'), ('%s');
        INSERT INTO schools(id,status) VALUES ('%s','active'), ('%s','active');
		INSERT INTO school_memberships(school_id,user_id,role,status)
		VALUES ('%s','%s','teacher','active'), ('%s','%s','teacher','active');
		INSERT INTO teaching_assignments(school_id,teacher_id,status)
		VALUES ('%s','%s','active'), ('%s','%s','active');
		INSERT INTO questions(id,workflow_status) VALUES ('%s','approved');
	`, teacher, otherTeacher, ownSchool, otherSchool, ownSchool, teacher, ownSchool, otherTeacher,
		ownSchool, teacher, ownSchool, otherTeacher, questionID)
	if _, err := db.Exec(ctx, fixture); err != nil {
		t.Fatal(err)
	}
	request := func(actor, method, path, body string, want int) *httptest.ResponseRecorder {
		t.Helper()
		user := identity.User{ID: actor, Roles: []identity.Role{identity.RoleTeacher}}
		handler := questionhttp.New(questionapp.NewService(New(db, operationspg.NewAuditWriter())), templateHTTPActor{user})
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-CSRF-Token", "template-test")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		if response.Code != want {
			t.Fatalf("%s %s got %d want %d: %s", method, path, response.Code, want, response.Body)
		}
		return response
	}
	path := "/classroom-templates"
	body := fmt.Sprintf(`{"schoolId":%q,"title":"حزمة اختبار","questionIds":[%q],"challengeIds":[%q]}`, ownSchool, questionID, questionID)
	created := request(teacher, http.MethodPost, path, body, http.StatusCreated)
	var result struct {
		Template question.ClassroomPreparedTemplate
	}
	if err := json.Unmarshal(created.Body.Bytes(), &result); err != nil || result.Template.ID == "" {
		t.Fatalf("created template could not be parsed: %v", err)
	}
	listPath := path + "?schoolId=" + ownSchool
	own := request(teacher, http.MethodGet, listPath, "", http.StatusOK)
	if !strings.Contains(own.Body.String(), result.Template.ID) {
		t.Fatal("saved template missing from subsequent read")
	}
	other := request(otherTeacher, http.MethodGet, listPath, "", http.StatusOK)
	if strings.Contains(other.Body.String(), result.Template.ID) {
		t.Fatal("template appeared in someone else's list")
	}
	request(teacher, http.MethodGet, path+"?schoolId="+otherSchool, "", http.StatusForbidden)
	request(otherTeacher, http.MethodDelete, path+"/"+result.Template.ID, "", http.StatusNotFound)
	request(teacher, http.MethodDelete, path+"/"+result.Template.ID, "", http.StatusOK)
	own = request(teacher, http.MethodGet, listPath, "", http.StatusOK)
	if strings.Contains(own.Body.String(), result.Template.ID) {
		t.Fatal("deleted template still appeared after a fresh read")
	}
	var audited int
	err = db.QueryRow(ctx, "SELECT count(*) FROM audit_logs WHERE resource_id = $1", result.Template.ID).Scan(&audited)
	if err != nil || audited != 2 {
		t.Fatalf("expected one audit record per write: entries=%d error=%v", audited, err)
	}
}
