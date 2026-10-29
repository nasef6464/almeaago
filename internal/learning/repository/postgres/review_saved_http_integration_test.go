package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	learninghttp "github.com/nasef6464/almeaago/internal/learning/transport/http"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

const (
	reviewSavedStudent  = "00000000-0000-0000-0000-000000000181"
	reviewSavedOther    = "00000000-0000-0000-0000-000000000182"
	reviewSavedPath     = "00000000-0000-0000-0000-000000000183"
	reviewSavedSubject  = "00000000-0000-0000-0000-000000000184"
	reviewSavedQuestion = "00000000-0000-0000-0000-000000000185"
	reviewSavedCard     = "00000000-0000-0000-0000-000000000186"
)

type reviewSavedAuth struct {
	actor identity.User
}

func (a *reviewSavedAuth) Authenticate(_ context.Context, _ string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: a.actor}, nil
}

func (*reviewSavedAuth) VerifyCSRF(_ identityapp.Authenticated, token string) error {
	if token != "valid-csrf" {
		return errors.New("invalid csrf")
	}
	return nil
}

type reviewSavedQuestions struct{}

func (reviewSavedQuestions) ReviewBatch(_ context.Context, refs []question.ReviewRef) ([]question.ReviewProjection, error) {
	out := make([]question.ReviewProjection, 0, len(refs))
	for _, ref := range refs {
		out = append(out, question.ReviewProjection{
			ID: ref.QuestionID, Version: ref.Version, TextContent: "سؤال مراجعة",
		})
	}
	return out, nil
}

// Exercises the existing HTTP -> application -> real PostgreSQL repository ->
// HTTP library consumer without writing to production or altering RBAC/scoring.
func TestReviewSavedHTTPPostgres(t *testing.T) {
	f := newEvidenceFixture(t)
	_, err := f.db.Exec(f.ctx, `INSERT INTO review_cards
		(id,student_id,question_id,question_version,path_id,subject_id,review_type,
		 saved_for_review,has_mistake,next_review_at,updated_at)
		VALUES($1,$2,$3,1,$4,$5,'mastery_review',false,false,$6,$6)`,
		reviewSavedCard, reviewSavedStudent, reviewSavedQuestion,
		reviewSavedPath, reviewSavedSubject, f.now.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}

	auth := &reviewSavedAuth{actor: identity.User{ID: reviewSavedStudent, Roles: []identity.Role{identity.RoleStudent}}}
	newHandler := func() http.Handler {
		return learninghttp.NewReview(learningapp.NewService(f.repo, reviewSavedQuestions{}), auth)
	}
	handler := newHandler()
	call := func(method, path, csrf string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, nil).WithContext(f.ctx)
		if csrf != "" {
			req.Header.Set("X-CSRF-Token", csrf)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}
	savedURL := "/questions/" + reviewSavedQuestion + "/saved"
	libraryURL := "/library?tab=saved&pathId=" + reviewSavedPath + "&subjectId=" + reviewSavedSubject
	assertLibrary := func(expected int) {
		t.Helper()
		rec := call(http.MethodGet, libraryURL, "")
		if rec.Code != http.StatusOK {
			t.Fatalf("library HTTP %d: %s", rec.Code, rec.Body.String())
		}
		var page learning.ReviewPage
		if err := json.Unmarshal(rec.Body.Bytes(), &page); err != nil {
			t.Fatal(err)
		}
		if len(page.Items) != expected {
			t.Fatalf("library items=%d want %d: %s", len(page.Items), expected, rec.Body.String())
		}
		if expected == 1 && (!page.Items[0].Card.SavedForReview ||
			page.Items[0].Card.QuestionID != reviewSavedQuestion) {
			t.Fatalf("saved card not persisted: %+v", page.Items[0].Card)
		}
	}
	cardState := func() (bool, time.Time) {
		t.Helper()
		var saved bool
		var updated time.Time
		if err := f.db.QueryRow(f.ctx, `SELECT saved_for_review,updated_at
			FROM review_cards WHERE student_id=$1::uuid AND question_id=$2::uuid`,
			reviewSavedStudent, reviewSavedQuestion).Scan(&saved, &updated); err != nil {
			t.Fatal(err)
		}
		return saved, updated
	}

	assertLibrary(0)
	if rec := call(http.MethodPut, savedURL, ""); rec.Code != http.StatusForbidden {
		t.Fatalf("missing CSRF must be forbidden: %d", rec.Code)
	}
	if saved, _ := cardState(); saved {
		t.Fatal("invalid CSRF changed saved state")
	}
	if rec := call(http.MethodPut, savedURL, "valid-csrf"); rec.Code != http.StatusOK {
		t.Fatalf("save HTTP %d: %s", rec.Code, rec.Body.String())
	}
	saved, firstSavedVersion := cardState()
	if !saved {
		t.Fatal("first PUT did not persist saved=true")
	}
	assertLibrary(1)
	handler = newHandler() // Simulate a fresh request/session after reload.
	assertLibrary(1)

	time.Sleep(25 * time.Millisecond)
	if rec := call(http.MethodPut, savedURL, "valid-csrf"); rec.Code != http.StatusOK {
		t.Fatalf("repeat save HTTP %d: %s", rec.Code, rec.Body.String())
	}
	saved, secondSavedVersion := cardState()
	if !saved || !secondSavedVersion.Equal(firstSavedVersion) {
		t.Fatalf("idempotent PUT invalidated review optimistic token: %v -> %v", firstSavedVersion, secondSavedVersion)
	}

	auth.actor = identity.User{ID: reviewSavedOther, Roles: []identity.Role{identity.RoleStudent}}
	assertLibrary(0)
	if rec := call(http.MethodPut, savedURL, "valid-csrf"); rec.Code != http.StatusNotFound {
		t.Fatalf("other learner save should be 404, got %d", rec.Code)
	}
	auth.actor = identity.User{ID: reviewSavedStudent, Roles: []identity.Role{identity.RoleTeacher}}
	if rec := call(http.MethodDelete, savedURL, "valid-csrf"); rec.Code != http.StatusForbidden {
		t.Fatalf("teacher review write should be 403, got %d", rec.Code)
	}
	auth.actor = identity.User{ID: reviewSavedStudent, Roles: []identity.Role{identity.RoleStudent}}
	assertLibrary(1)

	if rec := call(http.MethodDelete, savedURL, "valid-csrf"); rec.Code != http.StatusOK {
		t.Fatalf("unsave HTTP %d: %s", rec.Code, rec.Body.String())
	}
	saved, firstUnsavedVersion := cardState()
	if saved {
		t.Fatal("DELETE did not persist saved=false")
	}
	assertLibrary(0)
	time.Sleep(25 * time.Millisecond)
	if rec := call(http.MethodDelete, savedURL, "valid-csrf"); rec.Code != http.StatusOK {
		t.Fatalf("repeat unsave HTTP %d: %s", rec.Code, rec.Body.String())
	}
	saved, secondUnsavedVersion := cardState()
	if saved || !secondUnsavedVersion.Equal(firstUnsavedVersion) {
		t.Fatalf("idempotent DELETE invalidated review optimistic token: %v -> %v", firstUnsavedVersion, secondUnsavedVersion)
	}
	handler = newHandler()
	assertLibrary(0)
}

func TestReviewSavedManualCardLinkedSkillsPostgres(t *testing.T) {
	f := newEvidenceFixture(t)
	// LIKE INCLUDING ALL does not copy foreign keys. Recreate the actual
	// review_card_skills -> review_cards RESTRICT constraint for this case.
	_, err := f.observer.Exec(f.ctx, "ALTER TABLE "+f.app+".review_card_skills "+
		"ADD CONSTRAINT review_card_fk FOREIGN KEY(review_card_id) REFERENCES "+
		f.app+".review_cards(id) ON DELETE RESTRICT")
	if err != nil {
		t.Fatal(err)
	}
	const questionID = "00000000-0000-0000-0000-000000000187"
	const cardID = "00000000-0000-0000-0000-000000000188"
	_, err = f.db.Exec(f.ctx, `INSERT INTO review_cards
		(id,student_id,question_id,question_version,path_id,subject_id,review_type,
		 saved_for_review,saved_at,has_mistake,next_review_at,updated_at)
		VALUES($1,$2,$3,1,$4,$5,'saved_review',true,$6,false,$6,$6)`,
		cardID, reviewSavedStudent, questionID, reviewSavedPath, reviewSavedSubject, f.now)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = f.db.Exec(f.ctx, `INSERT INTO review_card_skills(review_card_id,skill_id)
		VALUES($1::uuid,$2::uuid)`, cardID, evidenceSkill); err != nil {
		t.Fatal(err)
	}
	auth := &reviewSavedAuth{actor: identity.User{ID: reviewSavedStudent, Roles: []identity.Role{identity.RoleStudent}}}
	handler := learninghttp.NewReview(learningapp.NewService(f.repo, reviewSavedQuestions{}), auth)
	deleteCard := func() {
		t.Helper()
		req := httptest.NewRequest(http.MethodDelete, "/questions/"+questionID+"/saved", nil).WithContext(f.ctx)
		req.Header.Set("X-CSRF-Token", "valid-csrf")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("manual-only unsave HTTP %d: %s", rec.Code, rec.Body.String())
		}
	}
	deleteCard()
	deleteCard() // repeated DELETE must remain successful.
	var cards, links int
	if err = f.db.QueryRow(f.ctx, `SELECT count(*) FROM review_cards WHERE id=$1::uuid`, cardID).Scan(&cards); err != nil {
		t.Fatal(err)
	}
	if err = f.db.QueryRow(f.ctx, `SELECT count(*) FROM review_card_skills WHERE review_card_id=$1::uuid`, cardID).Scan(&links); err != nil {
		t.Fatal(err)
	}
	if cards != 0 || links != 0 {
		t.Fatalf("manual-only card must be removed with its links: cards=%d links=%d", cards, links)
	}
}

func TestReviewSavedConcurrentEvidencePostgres(t *testing.T) {
	f := newEvidenceFixture(t)
	const questionID = "00000000-0000-0000-0000-000000000189"
	const cardID = "00000000-0000-0000-0000-000000000190"
	_, err := f.db.Exec(f.ctx, `INSERT INTO review_cards
		(id,student_id,question_id,question_version,path_id,subject_id,review_type,
		 saved_for_review,saved_at,has_mistake,next_review_at,updated_at)
		VALUES($1,$2,$3,1,$4,$5,'saved_review',true,$6,false,$6,$6)`,
		cardID, reviewSavedStudent, questionID, reviewSavedPath, reviewSavedSubject, f.now)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = f.db.Exec(f.ctx, `INSERT INTO review_card_skills(review_card_id,skill_id)
		VALUES($1::uuid,$2::uuid)`, cardID, evidenceSkill); err != nil {
		t.Fatal(err)
	}

	// Hold the row while an assessment/review writer promotes this card to
	// evidence. Unsave must observe the committed new state, not delete it
	// based on an earlier unlocked read.
	tx, err := f.db.BeginTx(f.ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(f.ctx)
	var locked string
	if err = tx.QueryRow(f.ctx, `SELECT id::text FROM review_cards WHERE id=$1::uuid FOR UPDATE`,
		cardID).Scan(&locked); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- f.repo.SetSavedReview(f.ctx, reviewSavedStudent, questionID, false) }()
	f.waitBlocked(t, 1)
	if _, err = tx.Exec(f.ctx, `UPDATE review_cards
		SET review_type='mastery_review',has_mistake=true,updated_at=now()
		WHERE id=$1::uuid`, cardID); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(f.ctx); err != nil {
		t.Fatal(err)
	}
	select {
	case err = <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-f.ctx.Done():
		t.Fatal(f.ctx.Err())
	}
	var saved, mistake bool
	var reviewType string
	if err = f.db.QueryRow(f.ctx, `SELECT saved_for_review,has_mistake,review_type
		FROM review_cards WHERE id=$1::uuid`, cardID).Scan(&saved, &mistake, &reviewType); err != nil {
		t.Fatalf("evidence card lost during concurrent unsave: %v", err)
	}
	if saved || !mistake || reviewType != "mastery_review" {
		t.Fatalf("concurrent unsave corrupted evidence: saved=%v mistake=%v type=%s", saved, mistake, reviewType)
	}
	var links int
	if err = f.db.QueryRow(f.ctx, `SELECT count(*) FROM review_card_skills
		WHERE review_card_id=$1::uuid`, cardID).Scan(&links); err != nil {
		t.Fatal(err)
	}
	if links != 1 {
		t.Fatalf("skill link lost during concurrent unsave: %d", links)
	}
}
