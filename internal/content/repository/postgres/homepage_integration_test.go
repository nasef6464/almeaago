package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	contenthttp "github.com/nasef6464/almeaago/internal/content/transport/http"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	identitypg "github.com/nasef6464/almeaago/internal/identity/repository/postgres"
	identityhttp "github.com/nasef6464/almeaago/internal/identity/transport/http"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	"github.com/nasef6464/almeaago/internal/platform/security"
)

type homepageAuditFailure struct{}

func (homepageAuditFailure) WriteTx(context.Context, pgx.Tx, operations.AuditEvent) error {
	return errors.New("audit unavailable")
}

// Runs only on an explicitly authorized, disposable test database. The actual
// migration is exercised in a unique schema; existing settings are untouched.
func TestHomepageSettingsHTTPPostgres(t *testing.T) {
	if os.Getenv("HOMEPAGE_TEST_DB") != "1" || os.Getenv("DATABASE_URL") == "" {
		t.Skip("HOMEPAGE_TEST_DB=1 and isolated DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	adminDB, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(adminDB.Close)
	schema := "homepage_test_" + fmt.Sprint(time.Now().UnixNano())
	if _, err = adminDB.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { adminDB.Exec(context.Background(), `DROP SCHEMA `+schema+` CASCADE`) })
	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	cfg.MaxConns = 5
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	for _, table := range []string{"paths", "courses", "lessons"} {
		if _, err = db.Exec(ctx, `CREATE TABLE `+table+`(id uuid PRIMARY KEY)`); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = db.Exec(ctx, `CREATE TABLE audit_logs (LIKE public.audit_logs INCLUDING ALL)`); err != nil {
		t.Fatal(err)
	}
	up, err := os.ReadFile("../../../../migrations/000045_homepage_settings.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	down, err := os.ReadFile("../../../../migrations/000045_homepage_settings.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	// Apply/rollback/reapply against the same real PostgreSQL schema.
	for _, sql := range [][]byte{up, down, up} {
		if _, err = db.Exec(ctx, string(sql)); err != nil {
			t.Fatal(err)
		}
	}
	const pathID = "01900000-0000-7000-8000-000000000001"
	const otherPathID = "01900000-0000-7000-8000-000000000004"
	const courseID = "01900000-0000-7000-8000-000000000002"
	const lessonID = "01900000-0000-7000-8000-000000000003"
	for _, pair := range [][2]string{{"paths", pathID}, {"paths", otherPathID}, {"courses", courseID}, {"lessons", lessonID}} {
		if _, err = db.Exec(ctx, `INSERT INTO `+pair[0]+`(id) VALUES ($1::uuid)`, pair[1]); err != nil {
			t.Fatal(err)
		}
	}
	ir := identitypg.New(db)
	hash, err := security.HashPassword("Homepage-test-pass-42!")
	if err != nil {
		t.Fatal(err)
	}
	createUser := func(role identity.Role) identity.User {
		t.Helper()
		user, err := ir.CreateUser(ctx, "تجربة الرئيسية", string(role)+"-"+schema+"@example.test", hash, role)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { adminDB.Exec(context.Background(), `DELETE FROM users WHERE id=$1::uuid`, user.ID) })
		return user
	}
	admin := createUser(identity.RoleAdmin)
	student := createUser(identity.RoleStudent)
	auth := identityapp.NewService(ir)
	repo := New(db, operationspg.NewAuditWriter())
	router := chi.NewRouter()
	router.Mount("/api/v1/auth", identityhttp.New(auth, false))
	router.Mount("/api/v1/content", contenthttp.NewManagementWithPresentation(nil, auth, nil, contentapp.NewHomepageService(repo)))
	server := httptest.NewServer(router)
	t.Cleanup(server.Close)
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar}
	const endpoint = "/api/v1/content/homepage-settings"
	call := func(method, path, body, csrf string, want int) content.HomepageSettings {
		t.Helper()
		req, err := http.NewRequestWithContext(ctx, method, server.URL+path, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-CSRF-Token", csrf)
		res, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		var data content.HomepageSettings
		if err = json.NewDecoder(res.Body).Decode(&data); err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != want {
			t.Fatalf("%s %s want %d got %d %v", method, path, want, res.StatusCode, data)
		}
		return data
	}
	count := func(sql string) int {
		t.Helper()
		var n int
		if err := db.QueryRow(ctx, sql).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	defaults := call("GET", endpoint, "", "", 200)
	if defaults["hero"].(map[string]any)["titleHighlight"] != "المئة" {
		t.Fatal(defaults)
	}
	if count(`SELECT count(*) FROM content_homepage_settings`) != 0 {
		t.Fatal("guest GET mutated settings")
	}
	call("PATCH", endpoint, `{}`, "", 401)
	login := func(email string) string {
		return call("POST", "/api/v1/auth/login", fmt.Sprintf(`{"email":%q,"password":"Homepage-test-pass-42!"}`, email), "", 200)["csrfToken"].(string)
	}
	csrf := login(student.Email)
	call("PATCH", endpoint, `{}`, csrf, 403)
	csrf = login(admin.Email)
	call("PATCH", endpoint, `{}`, "", 403)
	first := call("PATCH", endpoint, `{"brand":{"logoText":"هوية محفوظة","logoAccentText":"اختبار"},"hero":{"titlePrefix":"عنوان","description":"نص"},"navigation":{"showAutoPaths":false,"items":[{"id":"home","visible":false,"order":0}]},"featuredPathIds":["`+otherPathID+`","`+pathID+`","`+otherPathID+`"],"featuredCourseIds":["`+courseID+`"],"featuredArticleLessonIds":["`+lessonID+`"]}`, csrf, 200)
	if len(first["featuredPathIds"].([]any)) != 3 || first["featuredPathIds"].([]any)[0] != otherPathID || first["featuredPathIds"].([]any)[1] != pathID {
		t.Fatal("source duplicate/order semantics lost")
	}
	if first["navigation"].(map[string]any)["showAutoPaths"] != false {
		t.Fatal("false lost")
	}
	saved := call("PATCH", endpoint, `{"hero":{"titlePrefix":""}}`, csrf, 200)
	if saved["brand"].(map[string]any)["logoText"] != "هوية محفوظة" {
		t.Fatal("omitted top-level field was reset")
	}
	hero := saved["hero"].(map[string]any)
	if hero["titlePrefix"] != "" || hero["description"] != "" {
		t.Fatal("source nested replacement/clear semantics lost", hero)
	}
	// Invalid references roll back both scalar and relational mutations and audit.
	for _, refs := range []string{`["01900000-0000-7000-8000-000000000099"]`, `["invalid-id"]`} {
		call("PATCH", endpoint, `{"brand":{"logoText":"must roll back"},"featuredPathIds":`+refs+`}`, csrf, 409)
	}
	fresh := call("GET", endpoint, "", "", 200)
	if fresh["brand"].(map[string]any)["logoText"] != "هوية محفوظة" || len(fresh["featuredPathIds"].([]any)) != 3 {
		t.Fatal("failed transaction changed stored state", fresh)
	}
	if count(`SELECT count(*) FROM audit_logs WHERE action='content.homepage.updated'`) != 2 {
		t.Fatal("failed write audited as success")
	}
	if _, err := db.Exec(ctx, `DELETE FROM paths WHERE id=$1`, pathID); err == nil {
		t.Fatal("featured path FK did not protect reference")
	}
	// JSONB must not be a competing authority for relational references.
	if _, err := db.Exec(ctx, `UPDATE content_homepage_settings SET settings=settings||'{"featuredPathIds":[]}'::jsonb`); err == nil {
		t.Fatal("schema allows IDs duplicated inside presentation JSON")
	}
	broken := New(db, homepageAuditFailure{})
	if _, err := broken.PatchHomepageSettings(ctx, admin.ID, content.HomepageSettings{"brand": map[string]any{"logoText": "not committed"}}); err == nil {
		t.Fatal("audit failure committed")
	}
	fresh = call("GET", endpoint, "", "", 200)
	if fresh["brand"].(map[string]any)["logoText"] != "هوية محفوظة" {
		t.Fatal("audit failure did not roll back")
	}
	// Concurrent disjoint patches must survive; no read/modify/write lost update.
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for _, patch := range []content.HomepageSettings{{"brand": map[string]any{"logoText": "parallel"}}, {"navigation": map[string]any{"showAutoPaths": true}}} {
		wg.Add(1)
		go func(p content.HomepageSettings) {
			defer wg.Done()
			_, err := repo.PatchHomepageSettings(ctx, admin.ID, p)
			errs <- err
		}(patch)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	fresh = call("GET", endpoint, "", "", 200)
	if fresh["brand"].(map[string]any)["logoText"] != "parallel" || fresh["navigation"].(map[string]any)["showAutoPaths"] != true {
		t.Fatal("lost concurrent update", fresh)
	}
	call("PATCH", endpoint, `{"featuredPathIds":[]}`, csrf, 200)
	if count(`SELECT count(*) FROM content_homepage_featured_paths`) != 0 || count(`SELECT count(*) FROM content_homepage_featured_courses`) != 1 {
		t.Fatal("clearing one reference set cleared another")
	}
	if os.Getenv("HOMEPAGE_BROWSER_E2E") == "1" {
		// Reset isolated presentation data, leaving the real relational/security tests above intact.
		if _, err := db.Exec(ctx, `TRUNCATE content_homepage_settings CASCADE`); err != nil {
			t.Fatal(err)
		}
		web, err := filepath.Abs("../../../../apps/web")
		if err != nil {
			t.Fatal(err)
		}
		reference := exec.CommandContext(ctx, "node", "scripts/parity/homepage-reference.mjs")
		reference.Dir = filepath.Dir(filepath.Dir(web))
		if output, err := reference.CombinedOutput(); err != nil {
			t.Fatalf("homepage reference: %v %s", err, output)
		}
		cmd := exec.CommandContext(ctx, "npm", "run", "e2e", "--", "tests/e2e/homepage-settings-live.spec.ts")
		cmd.Dir = web
		cmd.Env = append(os.Environ(), "HOMEPAGE_LIVE=1", "HOMEPAGE_TEST_ADMIN_EMAIL="+admin.Email, "E2E_API_TARGET="+server.URL)
		output, err := cmd.CombinedOutput()
		t.Log(string(output))
		if err != nil {
			t.Fatal(err)
		}
		fresh = call("GET", endpoint, "", "", 200)
		if fresh["brand"].(map[string]any)["logoText"] != "هوية محفوظة" {
			t.Fatal("browser did not persist brand", fresh)
		}
	}

}
