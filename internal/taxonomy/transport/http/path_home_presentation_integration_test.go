package taxonomyhttp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomypg "github.com/nasef6464/almeaago/internal/taxonomy/repository/postgres"
)

type pathHomePresentationAuth struct{ taxonomyHTTPAuth }

func (pathHomePresentationAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: identity.User{ID: "30000000-0000-4000-8000-000000000001", Roles: []identity.Role{identity.RoleAdmin}}}, nil
}

func TestPathHomePresentationHTTPPostgres(t *testing.T) {
	if os.Getenv("PATH_HOME_PRESENTATION_DB_TEST") != "1" || os.Getenv("DATABASE_URL") == "" {
		t.Skip("PATH_HOME_PRESENTATION_DB_TEST=1 and dedicated loopback DATABASE_URL required")
	}
	dsn, err := url.Parse(os.Getenv("DATABASE_URL"))
	if err != nil || dsn.Hostname() != "127.0.0.1" || dsn.Port() != "55439" || dsn.Path != "/almeaa_owner_verify_20261101" || dsn.RawQuery != "sslmode=disable" {
		t.Fatal("refusing database outside the dedicated loopback verification instance")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn.String())
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("path_home_presentation_%d", time.Now().UnixNano())
	quotedSchema := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+quotedSchema); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanup, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		if _, err := admin.Exec(cleanup, "DROP SCHEMA "+quotedSchema+" CASCADE"); err != nil {
			t.Errorf("cleanup: %v", err)
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
	for _, table := range []string{"users", "paths", "levels", "subjects", "skills", "audit_logs"} {
		if _, err := db.Exec(ctx, "CREATE TABLE "+table+" (LIKE public."+table+" INCLUDING ALL)"); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(ctx, `INSERT INTO users(id,email,name,password_hash) VALUES('30000000-0000-4000-8000-000000000001','home-presentation@example.invalid','Synthetic admin','not-a-login-hash')`); err != nil {
		t.Fatal(err)
	}
	handler := New(taxonomyapp.NewService(taxonomypg.New(db)), pathHomePresentationAuth{})
	create := func(body string) string {
		t.Helper()
		response := taxonomyHTTPCall(handler, http.MethodPost, "/admin/paths", body, "valid-csrf")
		if response.Code != http.StatusCreated {
			t.Fatalf("create status=%d body=%s", response.Code, response.Body.String())
		}
		var created struct{ Path struct{ ID string } }
		if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil || created.Path.ID == "" {
			t.Fatalf("create envelope err=%v body=%s", err, response.Body.String())
		}
		return created.Path.ID
	}
	hidden := create(`{"code":"HIDDEN-HOME","name":"Hidden both","showInHome":false,"showInNavbar":false,"color":"#123456","settings":{"stageSelection":"none","studentTemplate":"simple"}}`)
	defaulted := create(`{"code":"DEFAULT-HOME","name":"Default home","showInNavbar":false}`)
	readPath := func(endpoint, id string) map[string]any {
		t.Helper()
		response := taxonomyHTTPCall(handler, http.MethodGet, endpoint, "", "")
		if response.Code != http.StatusOK {
			t.Fatalf("bootstrap status=%d body=%s", response.Code, response.Body.String())
		}
		var envelope struct{ Paths []map[string]any }
		if err := json.Unmarshal(response.Body.Bytes(), &envelope); err != nil {
			t.Fatal(err)
		}
		for _, row := range envelope.Paths {
			if row["id"] == id {
				return row
			}
		}
		t.Fatalf("path %s absent from %s", id, endpoint)
		return nil
	}
	assertState := func(want bool) {
		t.Helper()
		for _, endpoint := range []string{"/bootstrap?phase=core", "/admin/bootstrap"} {
			row := readPath(endpoint, hidden)
			if row["showInHome"] != want || row["showInNavbar"] != false || row["color"] != "#123456" {
				t.Fatalf("presentation lost on %s: %+v", endpoint, row)
			}
			settings, ok := row["settings"].(map[string]any)
			if !ok || settings["stageSelection"] != "none" || settings["studentTemplate"] != "simple" {
				t.Fatalf("unrelated settings overwritten: %+v", row)
			}
			if row := readPath(endpoint, defaulted); row["showInHome"] != nil {
				t.Fatalf("omitted home default materialized: %+v", row)
			}
		}
		var stored bool
		if err := db.QueryRow(ctx, `SELECT (presentation->>'showInHome')::boolean FROM paths WHERE id=$1::uuid`, hidden).Scan(&stored); err != nil || stored != want {
			t.Fatalf("stored home=%v want=%v err=%v", stored, want, err)
		}
	}
	assertState(false)
	for _, want := range []bool{true, false} {
		response := taxonomyHTTPCall(handler, http.MethodPatch, "/admin/paths/"+hidden, fmt.Sprintf(`{"showInHome":%t}`, want), "valid-csrf")
		if response.Code != http.StatusOK {
			t.Fatalf("home-only PATCH status=%d body=%s", response.Code, response.Body.String())
		}
		assertState(want)
	}
}
