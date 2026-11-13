package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	assessmentapp "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	assessmenthttp "github.com/nasef6464/almeaago/internal/assessment/transport/http"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
)

type preparedVisibleContent struct{}

func (preparedVisibleContent) ValidateAssessmentPlacementTarget(context.Context, string, string, string, string, string, string) (bool, error) {
	return true, nil
}
func (preparedVisibleContent) LearnerAssessmentScopeVisible(context.Context, string, string) (bool, error) {
	return true, nil
}

// Opt-in, disposable PostgreSQL only. Applies the real platform migrations in
// an isolated schema. Removing the activation guard happens in that schema only.
func TestPreparedQuizFullHTTPStartGuards(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_SELF_SCHEMA_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("disposable local PostgreSQL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("prepared_full_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+quoted); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+quoted+" CASCADE")
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	files, err := filepath.Glob("../../../../migrations/*.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(files)
	for _, file := range files {
		if strings.Compare(filepath.Base(file), "000059_") >= 0 {
			continue
		}
		sql, e := os.ReadFile(file)
		if e != nil {
			t.Fatal(e)
		}
		if _, e = db.Exec(ctx, string(sql)); e != nil {
			t.Fatalf("migration %s: %v", filepath.Base(file), e)
		}
	}
	_, err = db.Exec(ctx, `
INSERT INTO users(id,email,name,password_hash) VALUES
 ('00000000-0000-0000-0000-000000000001','prepared-owner@example.invalid','owner','test'),
 ('00000000-0000-0000-0000-000000000002','prepared-other@example.invalid','other','test');
INSERT INTO paths(id,code,name) VALUES ('00000000-0000-0000-0000-000000000003','PREP-P','path');
INSERT INTO subjects(id,path_id,code,name) VALUES ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','PREP-S','subject');
INSERT INTO questions(id,question_code,path_id,subject_id) VALUES ('00000000-0000-0000-0000-000000000005','PREP-Q','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004');
INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index) VALUES ('00000000-0000-0000-0000-000000000005',1,'mcq','question',0);
INSERT INTO question_options(question_id,version,option_index,option_text) VALUES ('00000000-0000-0000-0000-000000000005',1,0,'yes'),('00000000-0000-0000-0000-000000000005',1,1,'no');
INSERT INTO assessments(id,assessment_code) VALUES ('00000000-0000-0000-0000-000000000006','PREPARED'),('00000000-0000-0000-0000-000000000007','ORDINARY');
INSERT INTO assessment_versions(assessment_id,version,title,path_id,subject_id,assessment_kind,normal_mode,version_status,published_at,max_attempts)
 SELECT id,1,assessment_code,'00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','normal','exam','published',now(),20 FROM assessments WHERE id IN ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007');
UPDATE assessments SET workflow_status='approved',is_published=true,published_version=1 WHERE id IN ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007');
INSERT INTO assessment_version_questions(assessment_id,assessment_version,question_id,question_version)
 SELECT id,1,'00000000-0000-0000-0000-000000000005',1 FROM assessments WHERE id IN ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007');
INSERT INTO assessment_learning_placements(id,assessment_id,assessment_version,slot,path_id,subject_id) VALUES ('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000006',1,'tests','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004');
INSERT INTO assessment_assignments(id,assessment_id,assessment_version,created_by) VALUES ('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000006',1,'00000000-0000-0000-0000-000000000001');
INSERT INTO assessment_assignment_users(assignment_id,user_id) VALUES ('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000002');
INSERT INTO assessment_sessions(id,assessment_id,assessment_version,channel,session_code,status,created_by) VALUES
 ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000006',1,'live','prep-live','active','00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000006',1,'public','prep-public','active','00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000007',1,'public','ordinary-public','active','00000000-0000-0000-0000-000000000001');
INSERT INTO prepared_quiz_distributions(assessment_id,mode,audience_type) VALUES ('00000000-0000-0000-0000-000000000006','saher','targeted');
INSERT INTO prepared_quiz_target_users VALUES ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001');`)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	repo := New(db, operationspg.NewAuditWriter())
	defs := assessmentapp.NewService(repo)
	attempts := assessmentapp.NewAttemptService(repo)
	place := assessmentapp.NewPlacementService(repo, defs, preparedVisibleContent{})
	assign := assessmentapp.NewAssignmentService(repo)
	sessions := assessmentapp.NewSessionService(repo, defs)
	owner := identity.User{ID: "00000000-0000-0000-0000-000000000001", Roles: []identity.Role{identity.RoleStudent}}
	administrator := identity.User{ID: owner.ID, Roles: []identity.Role{identity.RoleAdmin}}
	other := identity.User{ID: "00000000-0000-0000-0000-000000000002", Roles: []identity.Role{identity.RoleStudent}}
	call := func(handler http.Handler, path, body, csrf string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
		r.Header.Set("X-CSRF-Token", csrf)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	assert := func(label string, w *httptest.ResponseRecorder, want int) {
		t.Helper()
		if w.Code != want {
			t.Fatalf("%s: got %d want %d: %s", label, w.Code, want, w.Body.String())
		}
	}
	assessmentID := "00000000-0000-0000-0000-000000000006"
	placementID := "00000000-0000-0000-0000-000000000008"
	assignmentID := "00000000-0000-0000-0000-000000000009"
	liveID := "00000000-0000-0000-0000-000000000010"
	statusPath := "/" + assessmentID + "/prepared-staging/status"
	statusCall := func(user identity.User, body, csrf string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodPut, statusPath, strings.NewReader(body))
		r.Header.Set("X-CSRF-Token", csrf)
		w := httptest.NewRecorder()
		assessmenthttp.New(defs, selfQuizTestAuth{user: user}, attempts).ServeHTTP(w, r)
		return w
	}
	assert("status csrf", statusCall(administrator, `{"enabled":true}`, "bad"), 403)
	assert("status student", statusCall(owner, `{"enabled":true}`, "test-csrf"), 403)
	assert("status missing", statusCall(administrator, `{}`, "test-csrf"), 400)
	if _, err = db.Exec(ctx, `UPDATE prepared_quiz_distributions SET due_exclusive=now()-interval '1 minute' WHERE assessment_id=$1::uuid`, assessmentID); err != nil {
		t.Fatal(err)
	}
	assert("status expired", statusCall(administrator, `{"enabled":true}`, "test-csrf"), 409)
	if _, err = db.Exec(ctx, `UPDATE prepared_quiz_distributions SET due_exclusive=NULL WHERE assessment_id=$1::uuid`, assessmentID); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `UPDATE subjects SET status='archived' WHERE id='00000000-0000-0000-0000-000000000004'`); err != nil {
		t.Fatal(err)
	}
	assert("status hidden subject", statusCall(administrator, `{"enabled":true}`, "test-csrf"), 409)
	if _, err = db.Exec(ctx, `UPDATE subjects SET status='active' WHERE id='00000000-0000-0000-0000-000000000004'`); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM prepared_quiz_target_users WHERE assessment_id=$1::uuid`, assessmentID); err != nil {
		t.Fatal(err)
	}
	assert("status empty audience", statusCall(administrator, `{"enabled":true}`, "test-csrf"), 409)
	if _, err = db.Exec(ctx, `INSERT INTO prepared_quiz_target_users VALUES($1::uuid,$2::uuid)`, assessmentID, owner.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM assessment_version_questions WHERE assessment_id=$1::uuid`, assessmentID); err != nil {
		t.Fatal(err)
	}
	assert("status empty questions", statusCall(administrator, `{"enabled":true}`, "test-csrf"), 409)
	if _, err = db.Exec(ctx, `INSERT INTO assessment_version_questions(assessment_id,assessment_version,question_id,question_version) VALUES($1::uuid,1,'00000000-0000-0000-0000-000000000005',1)`, assessmentID); err != nil {
		t.Fatal(err)
	}
	if _, _, err = New(db, nil).SetPreparedQuizEnabled(ctx, administrator.ID, assessmentID, true); err == nil {
		t.Fatal("activation succeeded without audit writer")
	}
	var activeBefore bool
	if err = db.QueryRow(ctx, `SELECT enabled FROM prepared_quiz_distributions WHERE assessment_id=$1::uuid`, assessmentID).Scan(&activeBefore); err != nil || activeBefore {
		t.Fatalf("audit failure did not roll back activation: %v %v", activeBefore, err)
	}
	activated := statusCall(administrator, `{"enabled":true}`, "test-csrf")
	assert("status activate", activated, 200)
	if !strings.Contains(activated.Body.String(), `"enabled":true`) || !strings.Contains(activated.Body.String(), `"wasEnabled":true`) {
		t.Fatalf("activation response %s", activated.Body.String())
	}
	assert("status activate retry", statusCall(administrator, `{"enabled":true}`, "test-csrf"), 200)
	if _, err = db.Exec(ctx, `UPDATE prepared_quiz_distributions SET mode='central' WHERE assessment_id=$1::uuid`, assessmentID); err == nil {
		t.Fatal("active metadata change allowed")
	}
	startRoutes := []struct {
		name        string
		makeHandler func(identity.User) http.Handler
		path        string
	}{
		{"direct", func(u identity.User) http.Handler {
			return assessmenthttp.New(defs, selfQuizTestAuth{user: u}, attempts)
		}, "/" + assessmentID + "/attempts"},
		{"placement", func(u identity.User) http.Handler {
			return assessmenthttp.NewPlacements(place, selfQuizTestAuth{user: u})
		}, "/" + placementID + "/start"},
		{"assignment", func(u identity.User) http.Handler {
			return assessmenthttp.NewAssignments(assign, selfQuizTestAuth{user: u})
		}, "/" + assignmentID + "/start"},
		{"live", func(u identity.User) http.Handler {
			return assessmenthttp.NewSessions(sessions, selfQuizTestAuth{user: u})
		}, "/" + liveID + "/start"},
	}
	for _, tc := range startRoutes {
		key := "prepared-" + tc.name + "-owner"
		body := fmt.Sprintf(`{"startKey":%q}`, key)
		assert(tc.name+" csrf", call(tc.makeHandler(owner), tc.path, body, "bad"), 403)
		first := call(tc.makeHandler(owner), tc.path, body, "test-csrf")
		assert(tc.name+" owner", first, 201)
		retry := call(tc.makeHandler(owner), tc.path, body, "test-csrf")
		assert(tc.name+" retry", retry, 201)
		var a, b struct {
			Attempt struct {
				ID string `json:"id"`
			} `json:"attempt"`
		}
		if json.Unmarshal(first.Body.Bytes(), &a) != nil || json.Unmarshal(retry.Body.Bytes(), &b) != nil || a.Attempt.ID == "" || a.Attempt.ID != b.Attempt.ID {
			t.Fatalf("%s retry returned different attempt", tc.name)
		}
		assert(tc.name+" other", call(tc.makeHandler(other), tc.path, fmt.Sprintf(`{"startKey":%q}`, "prepared-"+tc.name+"-other"), "test-csrf"), 403)
	}
	otherHandler := assessmenthttp.New(defs, selfQuizTestAuth{user: other}, attempts)
	assert("single shot other", call(otherHandler, "/"+assessmentID+"/submit", `{"answers":{},"submissionKey":"prepared-single-other"}`, "test-csrf"), 403)
	ownerHandler := assessmenthttp.New(defs, selfQuizTestAuth{user: owner}, attempts)
	singleBody := `{"answers":{"00000000-0000-0000-0000-000000000005":0},"submissionKey":"prepared-single-owner"}`
	singleFirst := call(ownerHandler, "/"+assessmentID+"/submit", singleBody, "test-csrf")
	assert("single shot owner", singleFirst, 201)
	singleRetry := call(ownerHandler, "/"+assessmentID+"/submit", singleBody, "test-csrf")
	assert("single shot retry", singleRetry, 201)
	var firstResult, retryResult struct {
		AttemptID string `json:"attemptId"`
	}
	if json.Unmarshal(singleFirst.Body.Bytes(), &firstResult) != nil || json.Unmarshal(singleRetry.Body.Bytes(), &retryResult) != nil || firstResult.AttemptID == "" || firstResult.AttemptID != retryResult.AttemptID {
		t.Fatal("single-shot retry returned different attempt")
	}
	public := assessmenthttp.NewPublicSessions(sessions)
	assert("prepared public", call(public, "/prep-public/start", `{"participantKey":"participant-123","startKey":"public-prepared-key"}`, ""), 403)
	assert("ordinary public", call(public, "/ordinary-public/start", `{"participantKey":"participant-123","startKey":"public-ordinary-key"}`, ""), 201)
	disabled := statusCall(administrator, `{"enabled":false}`, "test-csrf")
	assert("status disable", disabled, 200)
	if !strings.Contains(disabled.Body.String(), `"enabled":false`) || !strings.Contains(disabled.Body.String(), `"wasEnabled":true`) {
		t.Fatalf("disable response %s", disabled.Body.String())
	}
	var auditCount int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM audit_logs WHERE action='assessment.prepared.status' AND resource_id=$1`, assessmentID).Scan(&auditCount); err != nil || auditCount != 2 {
		t.Fatalf("activation audit count %d: %v", auditCount, err)
	}
	for _, tc := range startRoutes {
		body := fmt.Sprintf(`{"startKey":%q}`, "prepared-"+tc.name+"-after-disable")
		assert(tc.name+" after disable", call(tc.makeHandler(owner), tc.path, body, "test-csrf"), 403)
	}
	assert("public after disable", call(public, "/prep-public/start", `{"participantKey":"participant-456","startKey":"public-after-disable"}`, ""), 403)
	assert("existing retry after disable", call(ownerHandler, "/"+assessmentID+"/attempts", `{"startKey":"prepared-direct-owner"}`, "test-csrf"), 201)
	// A concurrent stage edit owns the assessment lock. Activation must wait,
	// then reject the newly expired draft rather than enabling stale content.
	editTx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = editTx.Exec(ctx, `SELECT id FROM assessments WHERE id=$1::uuid FOR UPDATE`, assessmentID); err != nil {
		t.Fatal(err)
	}
	if _, err = editTx.Exec(ctx, `UPDATE prepared_quiz_distributions SET due_exclusive=now()-interval '1 minute' WHERE assessment_id=$1::uuid`, assessmentID); err != nil {
		t.Fatal(err)
	}
	activationResult := make(chan error, 1)
	go func() {
		_, _, e := repo.SetPreparedQuizEnabled(ctx, administrator.ID, assessmentID, true)
		activationResult <- e
	}()
	select {
	case e := <-activationResult:
		t.Fatalf("activation ignored stage lock: %v", e)
	case <-time.After(100 * time.Millisecond):
	}
	if err = editTx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if err = <-activationResult; !errors.Is(err, assessment.ErrConflict) {
		t.Fatalf("activation ignored changed deadline: %v", err)
	}
	if _, err = db.Exec(ctx, `UPDATE prepared_quiz_distributions SET due_exclusive=NULL WHERE assessment_id=$1::uuid`, assessmentID); err != nil {
		t.Fatal(err)
	}
	assert("reactivate", statusCall(administrator, `{"enabled":true}`, "test-csrf"), 200)
	// The down migration must refuse to remove activation safety while live.
	down, err := os.ReadFile("../../../../migrations/000058_prepared_quiz_activation.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	conn, err := db.Acquire(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = conn.Exec(ctx, string(down)); err == nil {
		conn.Release()
		t.Fatal("rollback succeeded while enabled")
	}
	if _, err = conn.Exec(ctx, `ROLLBACK`); err != nil {
		conn.Release()
		t.Fatal(err)
	}
	conn.Release()
	assert("disable before rollback", statusCall(administrator, `{"enabled":false}`, "test-csrf"), 200)
	if _, err = db.Exec(ctx, string(down)); err != nil {
		t.Fatalf("safe rollback: %v", err)
	}
	if _, err = db.Exec(ctx, `UPDATE prepared_quiz_distributions SET enabled=true WHERE assessment_id=$1::uuid`, assessmentID); err == nil {
		t.Fatal("rollback did not restore disabled constraint")
	}
	assert("guard retained after rollback", call(ownerHandler, "/"+assessmentID+"/attempts", `{"startKey":"after-activation-rollback"}`, "test-csrf"), 403)
}
