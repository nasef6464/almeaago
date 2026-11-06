package taxonomyhttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomypg "github.com/nasef6464/almeaago/internal/taxonomy/repository/postgres"
)

// TestTaxonomyArchiveRestoreHTTPPostgres proves the actual HTTP -> service ->
// PostgreSQL -> HTTP readback chain. Session-local shadow tables ensure no
// permanent data is modified. CI must provide a migrated disposable database.
func TestTaxonomyArchiveRestoreHTTPPostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for live PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 1 // TEMP tables and all HTTP requests share one session.
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, table := range []string{"paths", "levels", "subjects"} {
		if _, err := db.Exec(ctx, "CREATE TEMP TABLE "+table+" (LIKE public."+table+" INCLUDING DEFAULTS INCLUDING CONSTRAINTS)"); err != nil {
			t.Fatalf("shadow %s: %v", table, err)
		}
	}
	for _, stmt := range []string{
		"CREATE TEMP TABLE users (id uuid PRIMARY KEY)",
		"CREATE TEMP TABLE audit_logs (actor_user_id uuid, action text, resource_type text, resource_id text, status text, metadata jsonb)",
		"INSERT INTO users(id) VALUES ('00000000-0000-0000-0000-000000000899')",
		"INSERT INTO paths(id,code,name,status) VALUES ('00000000-0000-0000-0000-000000000801','HTTP-PATH','Path','active')",
		"INSERT INTO levels(id,path_id,code,name,status) VALUES ('00000000-0000-0000-0000-000000000803','00000000-0000-0000-0000-000000000801','HTTP-LEVEL','Level','active')",
		"INSERT INTO subjects(id,path_id,level_id,code,name,status) VALUES ('00000000-0000-0000-0000-000000000804','00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000803','HTTP-SUBJECT','Subject','active')",
	} {
		if _, err := db.Exec(ctx, stmt); err != nil {
			t.Fatal(err)
		}
	}
	const actor = "00000000-0000-0000-0000-000000000899"
	const pathID = "00000000-0000-0000-0000-000000000801"
	const subjectID = "00000000-0000-0000-0000-000000000804"
	const levelID = "00000000-0000-0000-0000-000000000803"
	repo := taxonomypg.New(db)
	service := taxonomyapp.NewService(repo)
	admin := mutationAuth{user: identity.User{ID: actor, Roles: []identity.Role{identity.RoleAdmin}}}
	router := New(service, admin)

	request := func(method, url, body string, auth mutationAuth, csrf string) *httptest.ResponseRecorder {
		t.Helper()
		h := New(service, auth)
		if auth.user.ID == actor && auth.authErr == nil && auth.csrfErr == nil {
			h = router
		}
		req := httptest.NewRequest(method, url, strings.NewReader(body)).WithContext(ctx)
		req.Header.Set("Content-Type", "application/json")
		if csrf != "" {
			req.Header.Set("X-CSRF-Token", csrf)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	assertStatus := func(table, id, want string) {
		t.Helper()
		var got string
		if err := db.QueryRow(ctx, "SELECT status FROM "+table+" WHERE id=$1::uuid", id).Scan(&got); err != nil || got != want {
			t.Fatalf("%s persisted status=%q err=%v want=%q", table, got, err, want)
		}
	}
	assertReadback := func(wantPath, wantSubject bool) {
		t.Helper()
		public := request(http.MethodGet, "/bootstrap", "", admin, "")
		if public.Code != http.StatusOK {
			t.Fatalf("public HTTP=%d body=%s", public.Code, public.Body.String())
		}
		var body struct {
			Paths []struct{ ID string `json:"id"` } `json:"paths"`
			Subjects []struct{ ID string `json:"id"` } `json:"subjects"`
		}
		if err := json.Unmarshal(public.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		pathVisible, subjectVisible := false, false
		for _, row := range body.Paths {
			if row.ID == pathID { pathVisible = true }
		}
		for _, row := range body.Subjects {
			if row.ID == subjectID { subjectVisible = true }
		}
		if pathVisible != wantPath || subjectVisible != wantSubject {
			t.Fatalf("HTTP learner readback path=%v subject=%v want=%v/%v", pathVisible, subjectVisible, wantPath, wantSubject)
		}
		adminRead := request(http.MethodGet, "/admin/bootstrap", "", admin, "")
		if adminRead.Code != http.StatusOK || !strings.Contains(adminRead.Body.String(), subjectID) || !strings.Contains(adminRead.Body.String(), pathID) {
			t.Fatalf("admin lost archived canonical rows: HTTP=%d body=%s", adminRead.Code, adminRead.Body.String())
		}
		var savedPath, savedLevel string
		if err := db.QueryRow(ctx, "SELECT path_id::text,level_id::text FROM subjects WHERE id=$1::uuid", subjectID).Scan(&savedPath, &savedLevel); err != nil || savedPath != pathID || savedLevel != levelID {
			t.Fatalf("subject FK changed: path=%s level=%s err=%v", savedPath, savedLevel, err)
		}
	}
	assertReadback(true, true)
	for _, target := range []struct{ resource, table, id string }{
		{"subjects", "subjects", subjectID},
		{"paths", "paths", pathID},
	} {
		for _, status := range []string{"archived", "active"} {
			url := "/admin/"+target.resource+"/"+target.id
			body := `{"status":"`+status+`"}`
			for _, denied := range []struct{ name string; auth mutationAuth; csrf string; code int }{
				{"student", mutationAuth{user: identity.User{ID: actor, Roles: []identity.Role{identity.RoleStudent}}}, "valid-csrf", http.StatusForbidden},
				{"missing-csrf", admin, "", http.StatusForbidden},
				{"invalid-csrf", admin, "invalid", http.StatusForbidden},
				{"unauthenticated", mutationAuth{authErr: errors.New("no session")}, "valid-csrf", http.StatusUnauthorized},
			} {
				rec := request(http.MethodPatch, url, body, denied.auth, denied.csrf)
				if rec.Code != denied.code {
					t.Fatalf("%s %s %s: HTTP=%d want=%d body=%s", target.resource, status, denied.name, rec.Code, denied.code, rec.Body.String())
				}
			}
			before := "active"
			if status == "active" { before = "archived" }
			assertStatus(target.table, target.id, before)
			rec := request(http.MethodPatch, url, body, admin, "valid-csrf")
			if rec.Code != http.StatusOK {
				t.Fatalf("%s %s HTTP=%d body=%s", target.resource, status, rec.Code, rec.Body.String())
			}
			assertStatus(target.table, target.id, status)
			want := status == "active"
			if target.resource == "subjects" {
				assertReadback(true, want)
			} else {
				assertReadback(want, want)
			}
		}
	}
	var count int
	if err := db.QueryRow(ctx, "SELECT count(*) FROM audit_logs WHERE actor_user_id=$1::uuid AND action IN ('taxonomy.path.update','taxonomy.subject.update')", actor).Scan(&count); err != nil || count != 4 {
		t.Fatalf("audit count=%d err=%v want=4", count, err)
	}
}
