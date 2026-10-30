package taxonomyhttp

import (
	"context"
	"encoding/json"
	"errors"
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
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
	taxonomypostgres "github.com/nasef6464/almeaago/internal/taxonomy/repository/postgres"
)

type displayIntegrationAuth struct{}

func (displayIntegrationAuth) Authenticate(_ context.Context, token string) (identityapp.Authenticated, error) {
	switch token {
	case "admin":
		return identityapp.Authenticated{User: identity.User{ID: "00000000-0000-0000-0000-000000000001", Roles: []identity.Role{identity.RoleAdmin}}}, nil
	case "teacher":
		return identityapp.Authenticated{User: identity.User{ID: "00000000-0000-0000-0000-000000000001", Roles: []identity.Role{identity.RoleTeacher}}}, nil
	default:
		return identityapp.Authenticated{}, errors.New("invalid session")
	}
}

func (displayIntegrationAuth) VerifyCSRF(_ identityapp.Authenticated, token string) error {
	if token != "csrf" {
		return errors.New("csrf")
	}
	return nil
}

func TestTaxonomyDisplayHTTPPostgres(t *testing.T) {
	if os.Getenv("TAXONOMY_TEST_DB") != "1" || os.Getenv("DATABASE_URL") == "" {
		t.Skip("TAXONOMY_TEST_DB=1 and isolated DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	admin, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()

	schema := fmt.Sprintf("taxonomy_display_http_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE")

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

	for _, table := range []string{"users", "paths", "levels", "subjects", "skills", "audit_logs"} {
		if _, err := db.Exec(ctx, "CREATE TABLE "+table+" (LIKE public."+table+" INCLUDING ALL)"); err != nil {
			t.Fatal(err)
		}
	}
	actorID := "00000000-0000-0000-0000-000000000001"
	if _, err := db.Exec(ctx, `INSERT INTO users(id,email,name,password_hash) VALUES($1,'display@example.test','display','test')`, actorID); err != nil {
		t.Fatal(err)
	}

	repo := taxonomypostgres.New(db)
	path, err := repo.CreatePath(ctx, actorID, taxonomy.PathWrite{Code: "DISPLAY", Name: "عرض", SortOrder: 1})
	if err != nil {
		t.Fatal(err)
	}
	subject, err := repo.CreateSubject(ctx, actorID, taxonomy.SubjectWrite{PathID: path.ID, Code: "SUB", Name: "مادة", SortOrder: 1})
	if err != nil {
		t.Fatal(err)
	}
	handler := New(taxonomyapp.NewService(repo), displayIntegrationAuth{})

	serve := func(method, target, body, token string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(method, target, strings.NewReader(body))
		if token != "" {
			request.Header.Set("Authorization", "Bearer "+token)
		}
		if method == http.MethodPatch {
			request.Header.Set("X-CSRF-Token", "csrf")
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		return response
	}

	if _, err := db.Exec(ctx, `UPDATE paths SET presentation=presentation || '{"keep":"yes"}'::jsonb || jsonb_build_object('settings',COALESCE(presentation->'settings','{}'::jsonb) || '{"keep":true}'::jsonb) WHERE id=$1::uuid`, path.ID); err != nil {
		t.Fatal(err)
	}

	pathPatch := `{"showInNavbar":false,"showInHome":true,"settings":{"showSubjectCards":false,"showMockExamCard":false,"showPackageCard":false,"studentTemplate":"simple","stageSelection":"required","stageLabel":""}}`
	pathResponse := serve(http.MethodPatch, "/admin/paths/"+path.ID, pathPatch, "admin")
	if pathResponse.Code != http.StatusOK {
		t.Fatalf("path patch status=%d body=%s", pathResponse.Code, pathResponse.Body.String())
	}
	subjectPatch := `{"icon":"🧪","color":"#abcdef"}`
	subjectResponse := serve(http.MethodPatch, "/admin/subjects/"+subject.ID, subjectPatch, "admin")
	if subjectResponse.Code != http.StatusOK {
		t.Fatalf("subject patch status=%d body=%s", subjectResponse.Code, subjectResponse.Body.String())
	}

	var kept, nestedKept bool
	if err := db.QueryRow(ctx, `SELECT presentation->>'keep'='yes',presentation->'settings'->>'keep'='true' FROM paths WHERE id=$1::uuid`, path.ID).Scan(&kept, &nestedKept); err != nil || !kept || !nestedKept {
		t.Fatalf("presentation merge lost unrelated fields: kept=%v nested=%v err=%v", kept, nestedKept, err)
	}

	public := serve(http.MethodGet, "/bootstrap?phase=core", "", "")
	if public.Code != http.StatusOK || !strings.Contains(public.Header().Get("Cache-Control"), "public") {
		t.Fatalf("public bootstrap status=%d headers=%v body=%s", public.Code, public.Header(), public.Body.String())
	}
	if !strings.Contains(public.Header().Get("Vary"), "Cookie") || !strings.Contains(public.Header().Get("Vary"), "Authorization") {
		t.Fatalf("public bootstrap missing Vary: %v", public.Header())
	}
	var projection map[string]any
	if err := json.Unmarshal(public.Body.Bytes(), &projection); err != nil {
		t.Fatal(err)
	}
	paths := projection["paths"].([]any)
	subjects := projection["subjects"].([]any)
	if len(paths) != 1 || len(subjects) != 1 {
		t.Fatalf("public taxonomy shape: %s", public.Body.String())
	}
	pathDTO := paths[0].(map[string]any)
	settings := pathDTO["settings"].(map[string]any)
	subjectDTO := subjects[0].(map[string]any)
	if pathDTO["showInNavbar"] != false || pathDTO["showInHome"] != true ||
		settings["showSubjectCards"] != false || settings["showMockExamCard"] != false || settings["showPackageCard"] != false || settings["studentTemplate"] != "simple" || settings["stageSelection"] != "required" || settings["stageLabel"] != "" ||
		subjectDTO["icon"] != "🧪" || subjectDTO["color"] != "#abcdef" {
		t.Fatalf("saved display metadata did not reach public consumer: %s", public.Body.String())
	}

	homeHidden := serve(http.MethodPatch, "/admin/paths/"+path.ID, `{"showInHome":false}`, "admin")
	if homeHidden.Code != http.StatusOK {
		t.Fatalf("showInHome-only patch status=%d body=%s", homeHidden.Code, homeHidden.Body.String())
	}
	homeHiddenView := serve(http.MethodGet, "/bootstrap?phase=core", "", "")
	if err := json.Unmarshal(homeHiddenView.Body.Bytes(), &projection); err != nil {
		t.Fatal(err)
	}
	paths = projection["paths"].([]any)
	if paths[0].(map[string]any)["showInNavbar"] != false || paths[0].(map[string]any)["showInHome"] != false {
		t.Fatalf("showInHome patch changed the independent navbar flag: %s", homeHiddenView.Body.String())
	}

	var keptAfter, nestedKeptAfter bool
	if err := db.QueryRow(ctx, `SELECT presentation->>'keep'='yes',presentation->'settings'->>'keep'='true' FROM paths WHERE id=$1::uuid`, path.ID).Scan(&keptAfter, &nestedKeptAfter); err != nil || !keptAfter || !nestedKeptAfter {
		t.Fatalf("showInHome-only patch discarded unknown presentation keys: kept=%v nested=%v err=%v", keptAfter, nestedKeptAfter, err)
	}

	if _, err := db.Exec(ctx, `ALTER TABLE audit_logs ADD CONSTRAINT reject_display_update CHECK (action <> 'taxonomy.path.update') NOT VALID`); err != nil {
		t.Fatal(err)
	}
	failed := serve(http.MethodPatch, "/admin/paths/"+path.ID, `{"showInNavbar":true}`, "admin")
	if failed.Code != http.StatusInternalServerError {
		t.Fatalf("audit failure status=%d body=%s", failed.Code, failed.Body.String())
	}
	afterFailure := serve(http.MethodGet, "/bootstrap?phase=core", "", "")
	if err := json.Unmarshal(afterFailure.Body.Bytes(), &projection); err != nil {
		t.Fatal(err)
	}
	paths = projection["paths"].([]any)
	if paths[0].(map[string]any)["showInNavbar"] != false {
		t.Fatalf("failed audit committed display change: %s", afterFailure.Body.String())
	}

	if _, err := db.Exec(ctx, `UPDATE paths SET status='inactive' WHERE id=$1::uuid`, path.ID); err != nil {
		t.Fatal(err)
	}
	studentView := serve(http.MethodGet, "/bootstrap?phase=core", "", "")
	if err := json.Unmarshal(studentView.Body.Bytes(), &projection); err != nil {
		t.Fatal(err)
	}
	if len(projection["paths"].([]any)) != 0 || len(projection["subjects"].([]any)) != 0 {
		t.Fatalf("inactive path leaked to anonymous consumer: %s", studentView.Body.String())
	}
	teacherView := serve(http.MethodGet, "/bootstrap?phase=core", "", "teacher")
	if err := json.Unmarshal(teacherView.Body.Bytes(), &projection); err != nil {
		t.Fatal(err)
	}
	if len(projection["paths"].([]any)) != 0 || strings.Contains(teacherView.Header().Get("Cache-Control"), "private") {
		t.Fatalf("teacher received unscoped inactive taxonomy: headers=%v body=%s", teacherView.Header(), teacherView.Body.String())
	}
	adminView := serve(http.MethodGet, "/bootstrap?phase=core", "", "admin")
	if adminView.Code != http.StatusOK || adminView.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatalf("admin navigation cache policy status=%d headers=%v", adminView.Code, adminView.Header())
	}
	if err := json.Unmarshal(adminView.Body.Bytes(), &projection); err != nil {
		t.Fatal(err)
	}
	paths = projection["paths"].([]any)
	if len(paths) != 1 || paths[0].(map[string]any)["isActive"] != false {
		t.Fatalf("admin navigation lost inactive path: %s", adminView.Body.String())
	}
}
