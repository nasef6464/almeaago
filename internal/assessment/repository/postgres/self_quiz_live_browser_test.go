package postgres

import (
	"context"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	aiapp "github.com/nasef6464/almeaago/internal/ai/application"
	aipg "github.com/nasef6464/almeaago/internal/ai/repository/postgres"
	aihttp "github.com/nasef6464/almeaago/internal/ai/transport/http"
	assessmentapp "github.com/nasef6464/almeaago/internal/assessment/application"
	assessmenthttp "github.com/nasef6464/almeaago/internal/assessment/transport/http"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	identitypg "github.com/nasef6464/almeaago/internal/identity/repository/postgres"
	identityhttp "github.com/nasef6464/almeaago/internal/identity/transport/http"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learningpg "github.com/nasef6464/almeaago/internal/learning/repository/postgres"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	"github.com/nasef6464/almeaago/internal/platform/security"
	questionpg "github.com/nasef6464/almeaago/internal/questionbank/repository/postgres"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomypg "github.com/nasef6464/almeaago/internal/taxonomy/repository/postgres"
	taxonomyhttp "github.com/nasef6464/almeaago/internal/taxonomy/transport/http"
)

// Opt-in: starts real Go handlers on an isolated test schema and launches a
// browser against Vite. It never runs against a production database.
func runSelfQuizLiveBrowser(t *testing.T, ctx context.Context, db *pgxpool.Pool) {
	t.Helper()
	if os.Getenv("SELF_QUIZ_LIVE_BROWSER") != "1" {
		return
	}
	identityRepo := identitypg.New(db)
	password := "Local-self-test-81!pass"
	hash, err := security.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	user, err := identityRepo.CreateUser(ctx, "طالب تجريبي", "self-browser@example.invalid", hash, identity.RoleStudent)
	if err != nil {
		t.Fatal(err)
	}
	auth := identityapp.NewService(identityRepo)
	repo := New(db, operationspg.NewAuditWriter())
	sink := learningapp.NewService(learningpg.New(db), nil)
	attempts := assessmentapp.NewAttemptServiceWithLearning(repo, sink)
	aiService := aiapp.NewService(aipg.New(db, operationspg.NewAuditWriter()), learningpg.New(db), questionpg.New(db, operationspg.NewAuditWriter()), nil, aiapp.Config{})
	aiService.SetResultReviewReader(repo)
	router := chi.NewRouter()
	router.Mount("/api/v1/auth", identityhttp.New(auth, false))
	router.Mount("/api/v1/taxonomy", taxonomyhttp.New(taxonomyapp.NewService(taxonomypg.New(db)), auth))
	router.Mount("/api/v1/assessment-attempts", assessmenthttp.NewAttempts(attempts, auth, assessmentapp.NewSelfQuizService(repo)))
	router.Mount("/api/v1/ai", aihttp.New(aiService, auth))
	server := httptest.NewServer(router)
	defer server.Close()
	webDir, err := filepath.Abs("../../../../apps/web")
	if err != nil {
		t.Fatal(err)
	}
	command := exec.CommandContext(ctx, "node", "node_modules/@playwright/test/cli.js", "test", "tests/e2e/self-quiz-live.spec.ts", "--project=chromium", "--workers=1")
	command.Dir = webDir
	command.Env = append(os.Environ(), "CI=1", "SELF_QUIZ_LIVE=1", "E2E_WEB_PORT=4267", "E2E_API_TARGET="+server.URL, "SELF_QUIZ_EMAIL="+user.Email, "SELF_QUIZ_PASSWORD="+password)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("self quiz live browser: %v\n%s", err, output)
	}
	t.Logf("self quiz live browser: %s", output)
	var sectionID string
	if err = db.QueryRow(ctx, `SELECT s.section_id::text FROM self_quiz_settings s JOIN assessment_attempts a ON a.id=s.attempt_id WHERE a.student_id=$1::uuid ORDER BY a.started_at DESC LIMIT 1`, user.ID).Scan(&sectionID); err != nil || sectionID != "00000000-0000-0000-0000-000000009001" {
		t.Fatalf("browser attempt section: %q %v", sectionID, err)
	}
	for _, query := range []string{
		`DELETE FROM review_card_skills WHERE review_card_id IN (SELECT id FROM review_cards WHERE student_id=$1::uuid)`,
		`DELETE FROM review_cards WHERE student_id=$1::uuid`,
		`DELETE FROM skill_progress WHERE student_id=$1::uuid`,
		`DELETE FROM mastery_evidence_skills WHERE evidence_id IN (SELECT id FROM mastery_evidence WHERE student_id=$1::uuid)`,
		`DELETE FROM mastery_evidence WHERE student_id=$1::uuid`,
		`DELETE FROM assessment_results WHERE student_id=$1::uuid`,
		`DELETE FROM assessment_answers WHERE self_attempt_id IN (SELECT id FROM assessment_attempts WHERE student_id=$1::uuid)`,
		`DELETE FROM self_quiz_question_skills WHERE attempt_id IN (SELECT id FROM assessment_attempts WHERE student_id=$1::uuid)`,
		`DELETE FROM self_quiz_questions WHERE attempt_id IN (SELECT id FROM assessment_attempts WHERE student_id=$1::uuid)`,
		`DELETE FROM self_quiz_target_skills WHERE attempt_id IN (SELECT id FROM assessment_attempts WHERE student_id=$1::uuid)`,
		`DELETE FROM self_quiz_settings WHERE attempt_id IN (SELECT id FROM assessment_attempts WHERE student_id=$1::uuid)`,
		`DELETE FROM assessment_attempts WHERE student_id=$1::uuid`,
	} {
		if _, err = db.Exec(ctx, query, user.ID); err != nil {
			t.Fatalf("cleanup live browser: %v", err)
		}
	}
}
