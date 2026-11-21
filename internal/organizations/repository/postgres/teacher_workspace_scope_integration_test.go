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

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	organizationshttp "github.com/nasef6464/almeaago/internal/organizations/transport/http"
)

type schoolScopeHTTPAuth struct{}

func (schoolScopeHTTPAuth) Authenticate(_ context.Context, token string) (identityapp.Authenticated, error) {
	if token == "" {
		return identityapp.Authenticated{}, identityapp.ErrUnauthenticated
	}
	roles := []identitydomain.Role{identitydomain.RoleTeacher}
	if token == "00000000-0000-0000-0000-000000008003" {
		roles = []identitydomain.Role{identitydomain.RoleStudent}
	}
	return identityapp.Authenticated{User: identitydomain.User{ID: token, Roles: roles}}, nil
}
func (schoolScopeHTTPAuth) VerifyCSRF(_ identityapp.Authenticated, token string) error {
	if token != "valid-test-csrf" {
		return identityapp.ErrCSRF
	}
	return nil
}

// An isolated PostgreSQL schema exercises the same query used by
// GET /api/v1/schools/teacher-workspace, without production fixtures.
func TestTeacherWorkspaceSchoolAndAssignmentIsolationPostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close(context.Background())
	schema := fmt.Sprintf("teacher_scope_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.MaxConns = 1
	config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET search_path TO "+schema)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	for _, ddl := range []string{
		"CREATE TABLE users (id uuid PRIMARY KEY, status text)",
		"CREATE TABLE user_roles (user_id uuid, role text)",
		"CREATE TABLE schools (id uuid PRIMARY KEY, name text, status text)",
		"CREATE TABLE classes (id uuid PRIMARY KEY, school_id uuid, name text, status text)",
		"CREATE TABLE teaching_assignments (id uuid PRIMARY KEY, school_id uuid, teacher_id uuid, class_id uuid, subject_id uuid, status text)",
		"CREATE TABLE school_memberships (school_id uuid, user_id uuid, role text, status text)",
		"CREATE TABLE class_memberships (class_id uuid, user_id uuid, status text)",
		"CREATE TABLE paths (id uuid PRIMARY KEY, status text)",
		"CREATE TABLE subjects (id uuid PRIMARY KEY, path_id uuid, status text)",
	} {
		if _, err := pool.Exec(ctx, ddl); err != nil {
			t.Fatal(err)
		}
	}
	const teacher = "00000000-0000-0000-0000-000000008001"
	const schoolAOnlyTeacher = "00000000-0000-0000-0000-000000008004"
	const studentA = "00000000-0000-0000-0000-000000008002"
	const studentB = "00000000-0000-0000-0000-000000008003"
	const schoolA = "00000000-0000-0000-0000-000000008011"
	const schoolB = "00000000-0000-0000-0000-000000008012"
	const classA = "00000000-0000-0000-0000-000000008021"
	const classB = "00000000-0000-0000-0000-000000008022"
	const subject = "00000000-0000-0000-0000-000000008031"
	const assignmentA = "00000000-0000-0000-0000-000000008041"
	const assignmentB = "00000000-0000-0000-0000-000000008042"
	const pathA = "00000000-0000-0000-0000-000000008051"
	const pathB = "00000000-0000-0000-0000-000000008052"
	const subjectB = "00000000-0000-0000-0000-000000008032"
	fixtures := []struct {
		sql  string
		args []any
	}{
		{"INSERT INTO users VALUES ($1,'active'),($2,'active'),($3,'active'),($4,'active')", []any{teacher, studentA, studentB, schoolAOnlyTeacher}},
		{"INSERT INTO user_roles VALUES ($1,'teacher'),($2,'teacher')", []any{teacher, schoolAOnlyTeacher}},
		{"INSERT INTO paths VALUES ($1,'active'),($2,'active')", []any{pathA, pathB}},
		{"INSERT INTO subjects VALUES ($1,$2,'active'),($3,$4,'active')", []any{subject, pathA, subjectB, pathB}},
		{"INSERT INTO schools VALUES ($1,'مدرسة ألف','active'),($2,'مدرسة باء','active')", []any{schoolA, schoolB}},
		{"INSERT INTO classes VALUES ($1,$2,'الأول ألف','active'),($3,$4,'الثاني باء','active')", []any{classA, schoolA, classB, schoolB}},
		{"INSERT INTO school_memberships VALUES ($1,$3,'teacher','active'),($2,$3,'teacher','active'),($1,$4,'student','active'),($2,$5,'student','active'),($1,$6,'teacher','active')", []any{schoolA, schoolB, teacher, studentA, studentB, schoolAOnlyTeacher}},
		{"INSERT INTO class_memberships VALUES ($1,$3,'active'),($2,$4,'active')", []any{classA, classB, studentA, studentB}},
		{"INSERT INTO teaching_assignments VALUES ($1,$3,$5,$6,$8,'active'),($2,$4,$5,$7,$9,'active'),($10,$3,$11,$6,$8,'active')", []any{assignmentA, assignmentB, schoolA, schoolB, teacher, classA, classB, subject, subjectB, "00000000-0000-0000-0000-000000008043", schoolAOnlyTeacher}},
	}
	for _, f := range fixtures {
		if _, err := pool.Exec(ctx, f.sql, f.args...); err != nil {
			t.Fatal(err)
		}
	}
	repo := New(pool, nil)

	// Exercise the actual HTTP router and application service against the
	// same disposable PostgreSQL fixture. Authentication here is a test
	// double: real session and CSRF integration still require separate proof.
	router := organizationshttp.New(orgapp.NewService(repo), schoolScopeHTTPAuth{})
	for _, tc := range []struct {
		name, token string
		status      int
		schoolIDs   []string
	}{
		{"school A only", schoolAOnlyTeacher, http.StatusOK, []string{schoolA}},
		{"both authorized schools", teacher, http.StatusOK, []string{schoolA, schoolB}},
		{"student cannot discover teacher schools", studentB, http.StatusForbidden, nil},
		{"unauthenticated", "", http.StatusUnauthorized, nil},
	} {
		t.Run("HTTP "+tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/teacher-workspace", nil)
			if tc.token != "" {
				req.AddCookie(&http.Cookie{Name: "almeaa_access_token", Value: tc.token})
				req.Header.Set("Authorization", "Bearer "+tc.token)
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != tc.status {
				t.Fatalf("HTTP status = %d, want %d: %s", rec.Code, tc.status, rec.Body.String())
			}
			if rec.Code != http.StatusOK {
				return
			}
			var payload struct {
				Schools []struct {
					SchoolID string `json:"schoolId"`
				} `json:"schools"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
				t.Fatal(err)
			}
			if len(payload.Schools) != len(tc.schoolIDs) {
				t.Fatalf("HTTP school disclosure: %+v, want %v", payload.Schools, tc.schoolIDs)
			}
			for _, school := range payload.Schools {
				found := false
				for _, id := range tc.schoolIDs {
					if school.SchoolID == id {
						found = true
					}
				}
				if !found {
					t.Fatalf("foreign school exposed over HTTP: %s", school.SchoolID)
				}
			}
			if got := rec.Header().Get("Cache-Control"); got != "private, no-store" {
				t.Fatalf("teacher workspace cache control = %q", got)
			}
		})
	}
	// A write with an invalid CSRF token must be rejected before reaching
	// any school mutation, even for an otherwise authenticated identity.
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"code":"FORBIDDEN","name":"Cross tenant"}`))
	req.Header.Set("Authorization", "Bearer "+teacher)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("CSRF rejection status = %d, want 403: %s", rec.Code, rec.Body.String())
	}
	var forbiddenCount int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM schools WHERE name='Cross tenant'").Scan(&forbiddenCount); err != nil {
		t.Fatal(err)
	}
	if forbiddenCount != 0 {
		t.Fatal("CSRF rejected request mutated PostgreSQL")
	}
	workspace, err := repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 2 {
		t.Fatalf("expected two authorized schools, got %+v", workspace.Schools)
	}
	for _, school := range workspace.Schools {
		if len(school.Assignments) != 1 || school.Assignments[0].StudentCount != 1 {
			t.Fatalf("unexpected school-scoped assignments %+v", school)
		}
		if school.SchoolID == schoolA && school.Assignments[0].ClassID != classA ||
			school.SchoolID == schoolB && school.Assignments[0].ClassID != classB {
			t.Fatalf("cross-school class disclosure %+v", school)
		}
	}
	// A separate teacher assigned only to school A must never discover school B,
	// even when another teacher has valid assignments in both schools.
	scopedWorkspace, err := repo.TeacherWorkspace(ctx, schoolAOnlyTeacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(scopedWorkspace.Schools) != 1 || scopedWorkspace.Schools[0].SchoolID != schoolA ||
		len(scopedWorkspace.Schools[0].Assignments) != 1 ||
		scopedWorkspace.Schools[0].Assignments[0].ClassID != classA {
		t.Fatalf("school A-only teacher can see foreign school or lost own class: %+v", scopedWorkspace.Schools)
	}
	allowedForScopedTeacher, err := repo.CanTeachSubject(ctx, schoolAOnlyTeacher, pathB, subjectB)
	if err != nil {
		t.Fatal(err)
	}
	if allowedForScopedTeacher {
		t.Fatal("school A-only teacher received school B subject permission")
	}
	// A forged assignment linking a class in school A to school B must not
	// disclose the class roster or grant teaching rights in either school.
	// The class-school relationship is checked independently of membership.
	if _, err := pool.Exec(ctx, "UPDATE teaching_assignments SET school_id=$1 WHERE id=$2", schoolB, assignmentA); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 1 || workspace.Schools[0].SchoolID != schoolB ||
		len(workspace.Schools[0].Assignments) != 1 ||
		workspace.Schools[0].Assignments[0].AssignmentID != assignmentB {
		t.Fatalf("cross-school assignment forged a visible class: %+v", workspace.Schools)
	}
	forgedAllowed, err := repo.CanTeachSubject(ctx, teacher, pathA, subject)
	if err != nil {
		t.Fatal(err)
	}
	if forgedAllowed {
		t.Fatal("cross-school assignment forged subject teaching permission")
	}
	if _, err := pool.Exec(ctx, "UPDATE teaching_assignments SET school_id=$1 WHERE id=$2", schoolA, assignmentA); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 2 {
		t.Fatalf("restored school assignment did not restore both schools: %+v", workspace.Schools)
	}
	// Authorization must follow the real assignment's subject and path,
	// not just the caller's global teacher role or another school's roster.
	for _, tc := range []struct {
		name, pathID, subjectID string
		allowed                 bool
	}{
		{"assigned subject", pathA, subject, true},
		{"other authorized school's subject", pathB, subjectB, true},
		{"mismatched path", pathB, subject, false},
		{"mismatched subject", pathA, subjectB, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			allowed, err := repo.CanTeachSubject(ctx, teacher, tc.pathID, tc.subjectID)
			if err != nil {
				t.Fatal(err)
			}
			if allowed != tc.allowed {
				t.Fatalf("CanTeachSubject(%s,%s) = %v, want %v", tc.pathID, tc.subjectID, allowed, tc.allowed)
			}
		})
	}
	// Revoking a school membership must revoke subject teaching permission
	// even while the assignment and global teacher role remain active.
	if _, err := pool.Exec(ctx, "UPDATE school_memberships SET status='inactive' WHERE school_id=$1 AND user_id=$2 AND role='teacher'", schoolA, teacher); err != nil {
		t.Fatal(err)
	}
	allowed, err := repo.CanTeachSubject(ctx, teacher, pathA, subject)
	if err != nil {
		t.Fatal(err)
	}
	if allowed {
		t.Fatal("revoked school membership still authorizes subject teaching")
	}
	// Revoking school A must not revoke a separate valid assignment in school B.
	allowed, err = repo.CanTeachSubject(ctx, teacher, pathB, subjectB)
	if err != nil {
		t.Fatal(err)
	}
	if !allowed {
		t.Fatal("revoking school A unexpectedly revoked school B teaching permission")
	}
	if _, err := pool.Exec(ctx, "UPDATE school_memberships SET status='active' WHERE school_id=$1 AND user_id=$2 AND role='teacher'", schoolA, teacher); err != nil {
		t.Fatal(err)
	}
	// Disabled content must not remain teachable through a stale assignment.
	if _, err := pool.Exec(ctx, "UPDATE subjects SET status='inactive' WHERE id=$1", subject); err != nil {
		t.Fatal(err)
	}
	allowed, err = repo.CanTeachSubject(ctx, teacher, pathA, subject)
	if err != nil {
		t.Fatal(err)
	}
	if allowed {
		t.Fatal("inactive subject still authorized")
	}
	if _, err := pool.Exec(ctx, "UPDATE subjects SET status='active' WHERE id=$1", subject); err != nil {
		t.Fatal(err)
	}

	// Teacher workspace and subject authorization must agree when content is
	// deactivated. An active teaching assignment must not expose a retired
	// subject or its parent path, including in a different school.
	for _, tc := range []struct {
		name, table, id string
	}{
		{"subject", "subjects", subject},
		{"path", "paths", pathA},
	} {
		t.Run("workspace excludes inactive "+tc.name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, "UPDATE "+tc.table+" SET status='inactive' WHERE id=$1", tc.id); err != nil {
				t.Fatal(err)
			}
			workspace, err := repo.TeacherWorkspace(ctx, teacher)
			if err != nil {
				t.Fatal(err)
			}
			if len(workspace.Schools) != 1 || workspace.Schools[0].SchoolID != schoolB {
				t.Fatalf("inactive %s exposed school A or removed school B: %+v", tc.name, workspace.Schools)
			}
			allowed, err := repo.CanTeachSubject(ctx, teacher, pathA, subject)
			if err != nil {
				t.Fatal(err)
			}
			if allowed {
				t.Fatalf("inactive %s still authorizes teaching", tc.name)
			}
			if _, err := pool.Exec(ctx, "UPDATE "+tc.table+" SET status='active' WHERE id=$1", tc.id); err != nil {
				t.Fatal(err)
			}
			workspace, err = repo.TeacherWorkspace(ctx, teacher)
			if err != nil {
				t.Fatal(err)
			}
			if len(workspace.Schools) != 2 {
				t.Fatalf("restored %s did not restore school A: %+v", tc.name, workspace.Schools)
			}
		})
	}

	// Duplicate teacher membership rows must not duplicate assignments or
	// produce a second copy of the same school/class in the HTTP response.
	if _, err := pool.Exec(ctx, "INSERT INTO school_memberships VALUES ($1,$2,'teacher','active')", schoolA, teacher); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 2 {
		t.Fatalf("duplicate teacher membership changed school count: %+v", workspace.Schools)
	}
	for _, school := range workspace.Schools {
		if len(school.Assignments) != 1 {
			t.Fatalf("duplicate teacher membership inflated assignments: %+v", school)
		}
	}
	// A duplicate class_memberships row must not double-count the same pupil.
	if _, err := pool.Exec(ctx, "INSERT INTO class_memberships VALUES ($1,$2,'active')", classA, studentA); err != nil {
		t.Fatal(err)
	}
	// A duplicate active school membership must not multiply the class roster.
	// A class member without an active student membership in that school must
	// never be counted, even when their class_memberships row is active.
	if _, err := pool.Exec(ctx, "INSERT INTO school_memberships VALUES ($1,$2,'student','active')", schoolA, studentA); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "INSERT INTO class_memberships VALUES ($1,$2,'active')", classA, studentB); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 2 {
		t.Fatalf("duplicate membership changed school scope: %+v", workspace.Schools)
	}
	for _, school := range workspace.Schools {
		if len(school.Assignments) != 1 || school.Assignments[0].StudentCount != 1 {
			t.Fatalf("duplicate or foreign student inflated school roster: %+v", school)
		}
	}
	// A disabled student account must not be counted merely because both
	// school and class memberships remain active. Re-enabling restores it.
	if _, err := pool.Exec(ctx, "UPDATE users SET status='inactive' WHERE id=$1", studentA); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	for _, school := range workspace.Schools {
		if school.SchoolID == schoolA && school.Assignments[0].StudentCount != 0 {
			t.Fatalf("disabled student identity still counted: %+v", school)
		}
	}
	if _, err := pool.Exec(ctx, "UPDATE users SET status='active' WHERE id=$1", studentA); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	for _, school := range workspace.Schools {
		if school.SchoolID == schoolA && school.Assignments[0].StudentCount != 1 {
			t.Fatalf("restored student identity missing from roster: %+v", school)
		}
	}
	if _, err := pool.Exec(ctx, "UPDATE school_memberships SET status='inactive' WHERE school_id=$1 AND user_id=$2 AND role='student'", schoolA, studentA); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	for _, school := range workspace.Schools {
		if school.SchoolID == schoolA && school.Assignments[0].StudentCount != 0 {
			t.Fatalf("revoked student membership still counted: %+v", school)
		}
	}
	if _, err := pool.Exec(ctx, "UPDATE school_memberships SET status='inactive' WHERE school_id=$1 AND user_id=$2 AND role='teacher'", schoolB, teacher); err != nil {
		t.Fatal(err)
	}
	// The same teacher may retain school A, but school B's independent subject
	// grant must be revoked as soon as B's membership is disabled.
	allowed, err = repo.CanTeachSubject(ctx, teacher, pathB, subjectB)
	if err != nil {
		t.Fatal(err)
	}
	if allowed {
		t.Fatal("revoked school B still authorizes its subject")
	}
	allowed, err = repo.CanTeachSubject(ctx, teacher, pathA, subject)
	if err != nil {
		t.Fatal(err)
	}
	if !allowed {
		t.Fatal("revoking school B unexpectedly revoked school A subject")
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 1 || workspace.Schools[0].SchoolID != schoolA {
		t.Fatalf("revoked school still visible: %+v", workspace.Schools)
	}
	if _, err := pool.Exec(ctx, "UPDATE teaching_assignments SET status='inactive' WHERE id=$1", assignmentA); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 0 {
		t.Fatalf("inactive teaching assignments still visible: %+v", workspace.Schools)
	}
	// A stale active assignment and school membership must not override a
	// revoked global teacher role or a disabled identity.
	if _, err := pool.Exec(ctx, "UPDATE teaching_assignments SET status='active' WHERE id=$1", assignmentA); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "DELETE FROM user_roles WHERE user_id=$1", teacher); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 0 {
		t.Fatalf("revoked global teacher role still exposes assignments: %+v", workspace.Schools)
	}
	if _, err := pool.Exec(ctx, "INSERT INTO user_roles VALUES ($1,'teacher')", teacher); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE users SET status='inactive' WHERE id=$1", teacher); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 0 {
		t.Fatalf("inactive teacher identity still exposes assignments: %+v", workspace.Schools)
	}
	if _, err := pool.Exec(ctx, "UPDATE users SET status='active' WHERE id=$1", teacher); err != nil {
		t.Fatal(err)
	}
	// Subject-level authorization must obey the same global identity and
	// school-state revocations as workspace visibility, not just assignment status.
	for _, tc := range []struct {
		name, revoke, restore string
	}{
		{"global teacher role", "DELETE FROM user_roles WHERE user_id='00000000-0000-0000-0000-000000008001'", "INSERT INTO user_roles VALUES ('00000000-0000-0000-0000-000000008001','teacher')"},
		{"teacher identity", "UPDATE users SET status='inactive' WHERE id='00000000-0000-0000-0000-000000008001'", "UPDATE users SET status='active' WHERE id='00000000-0000-0000-0000-000000008001'"},
		{"class status", "UPDATE classes SET status='inactive' WHERE id='00000000-0000-0000-0000-000000008021'", "UPDATE classes SET status='active' WHERE id='00000000-0000-0000-0000-000000008021'"},
		{"school status", "UPDATE schools SET status='inactive' WHERE id='00000000-0000-0000-0000-000000008011'", "UPDATE schools SET status='active' WHERE id='00000000-0000-0000-0000-000000008011'"},
		{"path status", "UPDATE paths SET status='inactive' WHERE id='00000000-0000-0000-0000-000000008051'", "UPDATE paths SET status='active' WHERE id='00000000-0000-0000-0000-000000008051'"},
		{"assignment status", "UPDATE teaching_assignments SET status='inactive' WHERE id='00000000-0000-0000-0000-000000008041'", "UPDATE teaching_assignments SET status='active' WHERE id='00000000-0000-0000-0000-000000008041'"},
	} {
		t.Run("subject grant revoked by "+tc.name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, tc.revoke); err != nil {
				t.Fatal(err)
			}
			allowed, err := repo.CanTeachSubject(ctx, teacher, pathA, subject)
			if err != nil {
				t.Fatal(err)
			}
			if allowed {
				t.Fatalf("%s still authorizes subject", tc.name)
			}
			if _, err := pool.Exec(ctx, tc.restore); err != nil {
				t.Fatal(err)
			}
			allowed, err = repo.CanTeachSubject(ctx, teacher, pathA, subject)
			if err != nil {
				t.Fatal(err)
			}
			if !allowed {
				t.Fatalf("%s restoration did not restore authorized subject", tc.name)
			}
		})
	}
	// A valid teacher assignment must not expose an inactive school. This also
	// guards against non-archived inactive statuses accidentally being visible.
	if _, err := pool.Exec(ctx, "UPDATE teaching_assignments SET status='active' WHERE id=$1", assignmentA); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE schools SET status='inactive' WHERE id=$1", schoolA); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 0 {
		t.Fatalf("inactive school still visible to teacher: %+v", workspace.Schools)
	}
	if _, err := pool.Exec(ctx, "UPDATE schools SET status='archived' WHERE id=$1", schoolA); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 0 {
		t.Fatalf("archived school still visible to teacher: %+v", workspace.Schools)
	}
}
