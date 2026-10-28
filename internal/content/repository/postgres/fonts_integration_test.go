package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	contenthttp "github.com/nasef6464/almeaago/internal/content/transport/http"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	identitypg "github.com/nasef6464/almeaago/internal/identity/repository/postgres"
	identityhttp "github.com/nasef6464/almeaago/internal/identity/transport/http"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	"github.com/nasef6464/almeaago/internal/platform/security"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Isolated CI database only. Session-local presentation/audit tables never
// touch stored site settings; the two disposable identities are cleaned up.
func TestPlatformFontsHTTPPostgres(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 1
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, table := range []string{"content_platform_font_settings", "audit_logs"} {
		if _, err = db.Exec(ctx, `CREATE TEMP TABLE `+table+` (LIKE public.`+table+` INCLUDING ALL)`); err != nil {
			t.Fatal(err)
		}
	}
	ir := identitypg.New(db)
	hash, err := security.HashPassword("Fonts-test-pass-42!")
	if err != nil {
		t.Fatal(err)
	}
	suffix := fmt.Sprint(time.Now().UnixNano())
	admin, err := ir.CreateUser(ctx, "مدير تجربة الخطوط", "fonts-admin-"+suffix+"@example.test", hash, identity.RoleAdmin)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM users WHERE id=$1::uuid`, admin.ID)
	student, err := ir.CreateUser(ctx, "طالب تجربة الخطوط", "fonts-student-"+suffix+"@example.test", hash, identity.RoleStudent)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM users WHERE id=$1::uuid`, student.ID)
	auth := identityapp.NewService(ir)
	router := chi.NewRouter()
	router.Mount("/api/v1/auth", identityhttp.New(auth, false))
	router.Mount("/api/v1/content", contenthttp.NewManagement(nil, auth, contentapp.NewFontService(New(db, operationspg.NewAuditWriter()))))
	server := httptest.NewServer(router)
	defer server.Close()
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar}
	call := func(method, path, body, csrf string, want int) map[string]any {
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
		data, _ := io.ReadAll(res.Body)
		if res.StatusCode != want {
			t.Fatalf("%s %s want %d got %d %s", method, path, want, res.StatusCode, data)
		}
		var result map[string]any
		_ = json.Unmarshal(data, &result)
		return result
	}
	const path = "/api/v1/content/platform-font-settings"
	settings := call("GET", path, "", "", 200)
	if settings["bodyFont"] != "tajawal" || settings["bodySize"] != "" {
		t.Fatalf("default: %#v", settings)
	}
	call("PATCH", path, `{"bodySize":"17px"}`, "", 401)
	login := func(email string) string {
		result := call("POST", "/api/v1/auth/login", fmt.Sprintf(`{"email":%q,"password":"Fonts-test-pass-42!"}`, email), "", 200)
		return result["csrfToken"].(string)
	}
	csrf := login(student.Email)
	call("PATCH", path, `{"bodySize":"17px"}`, csrf, 403)
	csrf = login(admin.Email)
	call("PATCH", path, `{"bodySize":"17px"}`, "", 403)
	call("PATCH", path, `{"bodyFont":"cairo","bodySize":"17px","headingColor":"#abcdef"}`, csrf, 200)
	settings = call("PATCH", path, `{"bodyColor":"#123456"}`, csrf, 200)
	if settings["bodyFont"] != "tajawal" || settings["bodySize"] != "17px" || settings["headingColor"] != "#abcdef" {
		t.Fatalf("PATCH source omission semantics: %#v", settings)
	}
	call("PATCH", path, `{"bodyColor":"red"}`, csrf, 400)
	settings = call("GET", path, "", "", 200)
	if settings["bodyColor"] != "#123456" {
		t.Fatalf("failed mutation persisted: %#v", settings)
	}
	settings = call("PATCH", path, `{"bodyColor":""}`, csrf, 200)
	if settings["bodyColor"] != "" {
		t.Fatal("clear did not persist")
	}
	// Two valid source uploads exceed the old generic content 256KiB limit.
	upload := `{"name":"LocalFont","size":220000,"mimeType":"font/woff2","dataUrl":"data:font/woff2;base64,` + strings.Repeat("A", 300000) + `"}`
	call("PATCH", path, `{"bodyCustomFont":`+upload+`,"headingCustomFont":`+upload+`}`, csrf, 200)
	var audits int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM pg_temp.audit_logs WHERE action='content.platform_fonts.updated'`).Scan(&audits); err != nil || audits != 4 {
		t.Fatalf("audit=%d err=%v", audits, err)
	}
	// The optional browser run uses real identity sessions and the same Go
	// handlers/SQL, with Vite proxying to this server; no intercepted font data.
	if os.Getenv("FONT_BROWSER_E2E") == "1" {
		_, err = db.Exec(ctx, `TRUNCATE pg_temp.content_platform_font_settings`)
		if err != nil {
			t.Fatal(err)
		}
		web, err := filepath.Abs("../../../../apps/web")
		if err != nil {
			t.Fatal(err)
		}
		reference := exec.CommandContext(ctx, "node", "scripts/parity/font-reference.mjs")
		reference.Dir = filepath.Dir(filepath.Dir(web))
		if output, err := reference.CombinedOutput(); err != nil {
			t.Fatalf("reference generation: %v %s", err, output)
		}
		cmd := exec.CommandContext(ctx, "npm", "run", "e2e", "--", "tests/e2e/platform-fonts-live.spec.ts")
		cmd.Dir = web
		cmd.Env = append(os.Environ(), "FONT_LIVE=1", "FONT_TEST_ADMIN_EMAIL="+admin.Email, "E2E_API_TARGET="+server.URL)
		output, err := cmd.CombinedOutput()
		t.Log(string(output))
		if err != nil {
			t.Fatal(err)
		}
		var persisted string
		if err = db.QueryRow(ctx, `SELECT settings->>'navigationSize' FROM pg_temp.content_platform_font_settings WHERE key='default'`).Scan(&persisted); err != nil || persisted != "18px" {
			t.Fatalf("browser persistence=%q err=%v", persisted, err)
		}
	}
}
