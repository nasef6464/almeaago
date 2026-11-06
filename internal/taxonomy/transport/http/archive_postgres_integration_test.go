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

	for _, table := range []string{"paths", "levels", "subjects", "skills"} {
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
		"INSERT INTO skills(id,subject_id,code,name,kind,status) VALUES ('00000000-0000-0000-0000-000000000805','00000000-0000-0000-0000-000000000804','HTTP-MAIN','Main skill','main','active')",
		"INSERT INTO skills(id,subject_id,parent_skill_id,code,name,kind,status) VALUES ('00000000-0000-0000-0000-000000000806','00000000-0000-0000-0000-000000000804','00000000-0000-0000-0000-000000000805','HTTP-SUB','Sub skill','sub','active')",
	} {
		if _, err := db.Exec(ctx, stmt); err != nil {
			t.Fatal(err)
		}
	}
	const actor = "00000000-0000-0000-0000-000000000899"
	const pathID = "00000000-0000-0000-0000-000000000801"
	const subjectID = "00000000-0000-0000-0000-000000000804"
	const levelID = "00000000-0000-0000-0000-000000000803"
	const mainSkillID = "00000000-0000-0000-0000-000000000805"
	const subSkillID = "00000000-0000-0000-0000-000000000806"
	repo := taxonomypg.New(db)
	service := taxonomyapp.NewService(repo)
	admin := mutationAuth{user: identity.User{ID: actor, Roles: []identity.Role{identity.RoleAdmin}}}
	request := func(method, url, body string, auth mutationAuth, csrf string) *httptest.ResponseRecorder {
		t.Helper()
		// Use the request's exact authenticator. Reusing the admin router for
		// a student sharing the fixture ID would bypass the RBAC check.
		h := New(service, auth)
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
		// /bootstrap is public by design. RBAC is checked on admin endpoints.
		public := request(http.MethodGet, "/bootstrap", "", mutationAuth{}, "")
		if public.Code != http.StatusOK {
			t.Fatalf("public HTTP=%d body=%s", public.Code, public.Body.String())
		}
		var body struct {
			Paths []struct {
				ID string `json:"id"`
			} `json:"paths"`
			Subjects []struct {
				ID string `json:"id"`
			} `json:"subjects"`
			Skills []struct {
				ID string `json:"id"`
			} `json:"skills"`
		}
		if err := json.Unmarshal(public.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		pathVisible, subjectVisible := false, false
		for _, row := range body.Paths {
			if row.ID == pathID {
				pathVisible = true
			}
		}
		for _, row := range body.Subjects {
			if row.ID == subjectID {
				subjectVisible = true
			}
		}
		skillCount := 0
		for _, row := range body.Skills {
			if row.ID == mainSkillID || row.ID == subSkillID {
				skillCount++
			}
		}
		wantSkills := 0
		if wantSubject {
			wantSkills = 2
		}
		if pathVisible != wantPath || subjectVisible != wantSubject || skillCount != wantSkills {
			t.Fatalf("HTTP public readback path=%v subject=%v skills=%d want=%v/%v/%d", pathVisible, subjectVisible, skillCount, wantPath, wantSubject, wantSkills)
		}
		deniedRead := request(http.MethodGet, "/admin/bootstrap", "", mutationAuth{user: identity.User{ID: actor, Roles: []identity.Role{identity.RoleStudent}}}, "")
		if deniedRead.Code != http.StatusForbidden {
			t.Fatalf("student admin bootstrap HTTP=%d want=403", deniedRead.Code)
		}
		adminRead := request(http.MethodGet, "/admin/bootstrap", "", admin, "")
		if adminRead.Code != http.StatusOK || !strings.Contains(adminRead.Body.String(), subjectID) || !strings.Contains(adminRead.Body.String(), pathID) {
			t.Fatalf("admin lost archived canonical rows: HTTP=%d body=%s", adminRead.Code, adminRead.Body.String())
		}
		var savedPath, savedLevel string
		if err := db.QueryRow(ctx, "SELECT path_id::text,level_id::text FROM subjects WHERE id=$1::uuid", subjectID).Scan(&savedPath, &savedLevel); err != nil || savedPath != pathID || savedLevel != levelID {
			t.Fatalf("subject FK changed: path=%s level=%s err=%v", savedPath, savedLevel, err)
		}
		var skillSubject, parentID string
		if err := db.QueryRow(ctx, "SELECT subject_id::text,parent_skill_id::text FROM skills WHERE id=$1::uuid", subSkillID).Scan(&skillSubject, &parentID); err != nil || skillSubject != subjectID || parentID != mainSkillID {
			t.Fatalf("subskill FK changed: subject=%s parent=%s err=%v", skillSubject, parentID, err)
		}
	}
	assertReadback(true, true)
	// A skill has its own archive lifecycle: archiving the subskill must
	// neither delete its parent nor break the subject/parent foreign keys.
	for _, status := range []string{"archived", "active"} {
		body := `{"status":"` + status + `"}`
		url := "/admin/skills/" + subSkillID
		for _, denied := range []struct {
			name string
			auth mutationAuth
			csrf string
			code int
		}{
			{"student", mutationAuth{user: identity.User{ID: actor, Roles: []identity.Role{identity.RoleStudent}}}, "valid-csrf", http.StatusForbidden},
			{"teacher", mutationAuth{user: identity.User{ID: actor, Roles: []identity.Role{identity.RoleTeacher}}}, "valid-csrf", http.StatusForbidden},
			{"missing-csrf", admin, "", http.StatusForbidden},
			{"unauthenticated", mutationAuth{authErr: errors.New("no session")}, "valid-csrf", http.StatusUnauthorized},
		} {
			rec := request(http.MethodPatch, url, body, denied.auth, denied.csrf)
			if rec.Code != denied.code {
				t.Fatalf("skill %s %s: HTTP=%d want=%d body=%s", status, denied.name, rec.Code, denied.code, rec.Body.String())
			}
		}
		before := "active"
		if status == "active" {
			before = "archived"
		}
		assertStatus("skills", subSkillID, before)
		var auditBefore int
		if err := db.QueryRow(ctx, "SELECT count(*) FROM audit_logs").Scan(&auditBefore); err != nil {
			t.Fatal(err)
		}
		rec := request(http.MethodPatch, url, body, admin, "valid-csrf")
		if rec.Code != http.StatusOK {
			t.Fatalf("skill %s HTTP=%d body=%s", status, rec.Code, rec.Body.String())
		}
		assertStatus("skills", subSkillID, status)
		assertStatus("skills", mainSkillID, "active")
		var auditAfter int
		if err := db.QueryRow(ctx, "SELECT count(*) FROM audit_logs").Scan(&auditAfter); err != nil || auditAfter != auditBefore+1 {
			t.Fatalf("skill audit count after %s: before=%d after=%d err=%v", status, auditBefore, auditAfter, err)
		}
		public := request(http.MethodGet, "/bootstrap", "", mutationAuth{}, "")
		if public.Code != http.StatusOK {
			t.Fatalf("skill readback HTTP=%d body=%s", public.Code, public.Body.String())
		}
		var response struct {
			Skills []struct {
				ID string `json:"id"`
			} `json:"skills"`
		}
		if err := json.Unmarshal(public.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		mainVisible, subVisible := false, false
		for _, skill := range response.Skills {
			mainVisible = mainVisible || skill.ID == mainSkillID
			subVisible = subVisible || skill.ID == subSkillID
		}
		if !mainVisible || subVisible != (status == "active") {
			t.Fatalf("skill HTTP readback main=%v sub=%v after %s", mainVisible, subVisible, status)
		}
		var subject, parent string
		if err := db.QueryRow(ctx, "SELECT subject_id::text,parent_skill_id::text FROM skills WHERE id=$1::uuid", subSkillID).Scan(&subject, &parent); err != nil || subject != subjectID || parent != mainSkillID {
			t.Fatalf("skill relations after %s: subject=%s parent=%s err=%v", status, subject, parent, err)
		}
	}
	assertReadback(true, true)
	// Parent-skill archival must hide active descendants without cascading
	// destructive updates to their persisted status or parent relationship.
	for _, status := range []string{"archived", "active"} {
		body := `{"status":"` + status + `"}`
		url := "/admin/skills/" + mainSkillID
		for _, denied := range []mutationAuth{
			{user: identity.User{ID: actor, Roles: []identity.Role{identity.RoleStudent}}},
			{user: identity.User{ID: actor, Roles: []identity.Role{identity.RoleTeacher}}},
		} {
			if rec := request(http.MethodPatch, url, body, denied, "valid-csrf"); rec.Code != http.StatusForbidden {
				t.Fatalf("parent skill %s unauthorized HTTP=%d", status, rec.Code)
			}
		}
		if rec := request(http.MethodPatch, url, body, admin, ""); rec.Code != http.StatusForbidden {
			t.Fatalf("parent skill %s missing CSRF HTTP=%d", status, rec.Code)
		}
		if rec := request(http.MethodPatch, url, body, admin, "valid-csrf"); rec.Code != http.StatusOK {
			t.Fatalf("parent skill %s HTTP=%d body=%s", status, rec.Code, rec.Body.String())
		}
		assertStatus("skills", mainSkillID, status)
		assertStatus("skills", subSkillID, "active")
		var savedSubject, savedParent string
		if err := db.QueryRow(ctx, "SELECT subject_id::text,parent_skill_id::text FROM skills WHERE id=$1::uuid", subSkillID).Scan(&savedSubject, &savedParent); err != nil || savedSubject != subjectID || savedParent != mainSkillID {
			t.Fatalf("parent skill %s child FK changed: subject=%s parent=%s err=%v", status, savedSubject, savedParent, err)
		}
		public := request(http.MethodGet, "/bootstrap", "", mutationAuth{}, "")
		if public.Code != http.StatusOK {
			t.Fatalf("parent skill %s public HTTP=%d", status, public.Code)
		}
		var response struct { Skills []struct { ID string `json:"id"` } `json:"skills"` }
		if err := json.Unmarshal(public.Body.Bytes(), &response); err != nil { t.Fatal(err) }
		count := 0
		for _, skill := range response.Skills {
			if skill.ID == mainSkillID || skill.ID == subSkillID { count++ }
		}
		want := 0
		if status == "active" { want = 2 }
		if count != want { t.Fatalf("parent skill %s learner count=%d want=%d", status, count, want) }
	}
	assertReadback(true, true)
	for _, target := range []struct{ resource, table, id string }{
		{"subjects", "subjects", subjectID},
		{"paths", "paths", pathID},
	} {
		for _, status := range []string{"archived", "active"} {
			url := "/admin/" + target.resource + "/" + target.id
			body := `{"status":"` + status + `"}`
			for _, denied := range []struct {
				name string
				auth mutationAuth
				csrf string
				code int
			}{
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
			if status == "active" {
				before = "archived"
			}
			// Rejected mutations must not alter the persisted row or emit an audit write.
			assertStatus(target.table, target.id, before)
			var auditBefore int
			if err := db.QueryRow(ctx, "SELECT count(*) FROM audit_logs").Scan(&auditBefore); err != nil {
				t.Fatal(err)
			}
			rec := request(http.MethodPatch, url, body, admin, "valid-csrf")
			if rec.Code != http.StatusOK {
				t.Fatalf("%s %s HTTP=%d body=%s", target.resource, status, rec.Code, rec.Body.String())
			}
			assertStatus(target.table, target.id, status)
			var auditAfter int
			if err := db.QueryRow(ctx, "SELECT count(*) FROM audit_logs").Scan(&auditAfter); err != nil || auditAfter != auditBefore+1 {
				t.Fatalf("audit write count after authorized %s %s: before=%d after=%d err=%v", target.resource, status, auditBefore, auditAfter, err)
			}
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
		t.Fatalf("path/subject audit count=%d err=%v want=4", count, err)
	}
	if err := db.QueryRow(ctx, "SELECT count(*) FROM audit_logs WHERE actor_user_id=$1::uuid AND action='taxonomy.skill.update'", actor).Scan(&count); err != nil || count != 4 {
		t.Fatalf("skill audit count=%d err=%v want=4", count, err)
	}
}
