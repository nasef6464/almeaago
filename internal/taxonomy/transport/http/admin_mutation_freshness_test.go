package taxonomyhttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

// The isolated repository models the write -> fresh public read contract without
// asserting PostgreSQL parity. Database-backed evidence remains a separate gate.
type taxonomyHTTPRepo struct {
	path   taxonomy.Path
	writes int
}

func (r *taxonomyHTTPRepo) PublicBootstrap(context.Context, bool) (taxonomy.Bootstrap, error) {
	rows := taxonomy.Bootstrap{Paths: []taxonomy.Path{}, Levels: []taxonomy.Level{}, Subjects: []taxonomy.Subject{}, Skills: []taxonomy.Skill{}}
	if r.path.ID != "" && r.path.Status == taxonomy.StatusActive {
		rows.Paths = append(rows.Paths, r.path)
	}
	return rows, nil
}
func (r *taxonomyHTTPRepo) AdminBootstrap(context.Context) (taxonomy.Bootstrap, error) {
	rows := taxonomy.Bootstrap{Paths: []taxonomy.Path{}, Levels: []taxonomy.Level{}, Subjects: []taxonomy.Subject{}, Skills: []taxonomy.Skill{}}
	if r.path.ID != "" {
		rows.Paths = append(rows.Paths, r.path)
	}
	return rows, nil
}
func (r *taxonomyHTTPRepo) CreatePath(_ context.Context, _ string, w taxonomy.PathWrite) (taxonomy.Path, error) {
	r.writes++
	r.path = taxonomy.Path{ID: "path-1", Code: w.Code, Name: w.Name, Status: taxonomy.StatusActive}
	return r.path, nil
}
func (r *taxonomyHTTPRepo) UpdatePath(_ context.Context, _, _ string, p taxonomy.PathPatch) (taxonomy.Path, error) {
	r.writes++
	if p.Status != nil {
		r.path.Status = *p.Status
	}
	return r.path, nil
}
func (*taxonomyHTTPRepo) CreateLevel(context.Context, string, taxonomy.LevelWrite) (taxonomy.Level, error) {
	return taxonomy.Level{}, nil
}
func (*taxonomyHTTPRepo) UpdateLevel(context.Context, string, string, taxonomy.LevelPatch) (taxonomy.Level, error) {
	return taxonomy.Level{}, nil
}
func (*taxonomyHTTPRepo) CreateSubject(context.Context, string, taxonomy.SubjectWrite) (taxonomy.Subject, error) {
	return taxonomy.Subject{}, nil
}
func (*taxonomyHTTPRepo) UpdateSubject(context.Context, string, string, taxonomy.SubjectPatch) (taxonomy.Subject, error) {
	return taxonomy.Subject{}, nil
}
func (*taxonomyHTTPRepo) CreateSkill(context.Context, string, taxonomy.SkillWrite) (taxonomy.Skill, error) {
	return taxonomy.Skill{}, nil
}
func (*taxonomyHTTPRepo) UpdateSkill(context.Context, string, string, taxonomy.SkillPatch) (taxonomy.Skill, error) {
	return taxonomy.Skill{}, nil
}

type taxonomyHTTPAuth struct {
	role   identity.Role
	unauth bool
}

func (a taxonomyHTTPAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	if a.unauth {
		return identityapp.Authenticated{}, errors.New("not signed in")
	}
	return identityapp.Authenticated{User: identity.User{ID: "admin-1", Roles: []identity.Role{a.role}}}, nil
}
func (taxonomyHTTPAuth) VerifyCSRF(_ identityapp.Authenticated, token string) error {
	if token != "valid-csrf" {
		return errors.New("csrf mismatch")
	}
	return nil
}
func taxonomyHTTPCall(h http.Handler, method, path, body, csrf string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if csrf != "" {
		req.Header.Set("X-CSRF-Token", csrf)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestTaxonomyMutationRejectsTrailingJSONBeforeWriting(t *testing.T) {
	cases := []struct {
		name, body             string
		wantStatus, wantWrites int
	}{
		{"one document", `{"code":"quant","name":"قدرات"}`, http.StatusCreated, 1},
		{"two documents", `{"code":"quant","name":"قدرات"}{"code":"other","name":"آخر"}`, http.StatusBadRequest, 0},
		{"trailing array", `{"code":"quant","name":"قدرات"} []`, http.StatusBadRequest, 0},
		{"trailing garbage", `{"code":"quant","name":"قدرات"} garbage`, http.StatusBadRequest, 0},
		{"unknown property", `{"code":"quant","name":"قدرات","unexpected":true}`, http.StatusBadRequest, 0},
		{"body limit after first document", `{"code":"quant","name":"قدرات"}` + strings.Repeat(" ", 65<<10), http.StatusBadRequest, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &taxonomyHTTPRepo{}
			handler := New(taxonomyapp.NewService(repo), taxonomyHTTPAuth{role: identity.RoleAdmin})
			rec := taxonomyHTTPCall(handler, http.MethodPost, "/admin/paths", tc.body, "valid-csrf")
			if rec.Code != tc.wantStatus || repo.writes != tc.wantWrites {
				t.Fatalf("status=%d writes=%d; want status=%d writes=%d; body=%s", rec.Code, repo.writes, tc.wantStatus, tc.wantWrites, rec.Body.String())
			}
		})
	}
}

func TestTaxonomyAdminWriteImmediatelyVisibleToFreshPublicRead(t *testing.T) {
	repo := &taxonomyHTTPRepo{}
	handler := New(taxonomyapp.NewService(repo), taxonomyHTTPAuth{role: identity.RoleAdmin})
	read := func(want int) {
		t.Helper()
		rec := taxonomyHTTPCall(handler, http.MethodGet, "/bootstrap?phase=full", "", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("public read status %d: %s", rec.Code, rec.Body.String())
		}
		if !strings.Contains(rec.Header().Get("Cache-Control"), "no-store") {
			t.Fatalf("public taxonomy is mutable by admin: stale HTTP cache allowed: %q", rec.Header().Get("Cache-Control"))
		}
		var result struct {
			Paths []struct {
				ID string `json:"id"`
			} `json:"paths"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if len(result.Paths) != want {
			t.Fatalf("public paths=%d, want %d", len(result.Paths), want)
		}
	}
	read(0)
	rec := taxonomyHTTPCall(handler, http.MethodPost, "/admin/paths", `{"code":"quant","name":"قدرات"}`, "valid-csrf")
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body.String())
	}
	read(1)
	rec = taxonomyHTTPCall(handler, http.MethodPatch, "/admin/paths/path-1", `{"status":"inactive"}`, "valid-csrf")
	if rec.Code != http.StatusOK {
		t.Fatalf("disable: %d %s", rec.Code, rec.Body.String())
	}
	read(0)
	admin := taxonomyHTTPCall(handler, http.MethodGet, "/admin/bootstrap", "", "")
	if admin.Code != http.StatusOK || !strings.Contains(admin.Body.String(), "inactive") {
		t.Fatalf("admin must retain disabled path for reactivation: %d %s", admin.Code, admin.Body.String())
	}
}

func TestTaxonomyMutationRejectsUnauthenticatedCSRFAndNonAdmin(t *testing.T) {
	cases := []struct {
		name string
		auth taxonomyHTTPAuth
		csrf string
		want int
	}{
		{"no session", taxonomyHTTPAuth{unauth: true}, "valid-csrf", http.StatusUnauthorized},
		{"no csrf", taxonomyHTTPAuth{role: identity.RoleAdmin}, "", http.StatusForbidden},
		{"teacher", taxonomyHTTPAuth{role: identity.RoleTeacher}, "valid-csrf", http.StatusForbidden},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &taxonomyHTTPRepo{}
			h := New(taxonomyapp.NewService(repo), tc.auth)
			rec := taxonomyHTTPCall(h, http.MethodPost, "/admin/paths", `{"code":"quant","name":"قدرات"}`, tc.csrf)
			if rec.Code != tc.want || repo.writes != 0 {
				t.Fatalf("status=%d writes=%d, want %d and zero writes", rec.Code, repo.writes, tc.want)
			}
		})
	}
}
