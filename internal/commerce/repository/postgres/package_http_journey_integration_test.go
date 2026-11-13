package postgres

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	assessmentapp "github.com/nasef6464/almeaago/internal/assessment/application"
	assessmentcatalog "github.com/nasef6464/almeaago/internal/assessment/catalog"
	assessmentdomain "github.com/nasef6464/almeaago/internal/assessment/domain"
	assessmentpg "github.com/nasef6464/almeaago/internal/assessment/repository/postgres"
	assessmenthttp "github.com/nasef6464/almeaago/internal/assessment/transport/http"
	commerceapp "github.com/nasef6464/almeaago/internal/commerce/application"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	commercehttp "github.com/nasef6464/almeaago/internal/commerce/transport/http"
	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	contentpg "github.com/nasef6464/almeaago/internal/content/repository/postgres"
	contenthttp "github.com/nasef6464/almeaago/internal/content/transport/http"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	identitypg "github.com/nasef6464/almeaago/internal/identity/repository/postgres"
	identityhttp "github.com/nasef6464/almeaago/internal/identity/transport/http"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	navigation "github.com/nasef6464/almeaago/internal/learning/navigation"
	learningpg "github.com/nasef6464/almeaago/internal/learning/repository/postgres"
	learninghttp "github.com/nasef6464/almeaago/internal/learning/transport/http"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	"github.com/nasef6464/almeaago/internal/platform/security"
	questiondomain "github.com/nasef6464/almeaago/internal/questionbank/domain"
	questionpg "github.com/nasef6464/almeaago/internal/questionbank/repository/postgres"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomypg "github.com/nasef6464/almeaago/internal/taxonomy/repository/postgres"
	taxonomyhttp "github.com/nasef6464/almeaago/internal/taxonomy/transport/http"
)

// Only use with a dedicated disposable database on which migrations were applied.
func TestPackageHTTPCheckoutJourney(t *testing.T) {
	url := os.Getenv("COMMERCE_JOURNEY_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("dedicated COMMERCE_JOURNEY_TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	suffix := fmt.Sprint(time.Now().UnixNano())
	var path, subject string
	identityRepo := identitypg.New(db)
	auth := identityapp.NewService(identityRepo)
	password := "Local-test-41!pass"
	hash, err := security.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	adminUser, err := identityRepo.CreateUser(ctx, "admin", "admin"+suffix+"@example.invalid", hash, identity.RoleAdmin)
	if err != nil {
		t.Fatal(err)
	}
	studentUser, err := identityRepo.CreateUser(ctx, "student", "student"+suffix+"@example.invalid", hash, identity.RoleStudent)
	if err != nil {
		t.Fatal(err)
	}
	student := studentUser.ID
	login := func(email string) (string, string) {
		t.Helper()
		body, _ := json.Marshal(map[string]string{"email": email, "password": password})
		req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(body))
		recorder := httptest.NewRecorder()
		identityhttp.New(auth, false).ServeHTTP(recorder, req)
		if recorder.Code != http.StatusOK {
			t.Fatalf("login HTTP status %d", recorder.Code)
		}
		var result struct {
			CSRFToken string `json:"csrfToken"`
		}
		if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		for _, cookie := range recorder.Result().Cookies() {
			if cookie.Name == identitysession.CookieName && cookie.Value != "" && result.CSRFToken != "" {
				return cookie.Value, result.CSRFToken
			}
		}
		t.Fatal("login did not issue session cookie and CSRF token")
		return "", ""
	}
	adminToken, adminCSRF := login(adminUser.Email)
	studentToken, studentCSRF := login(studentUser.Email)
	if err = db.QueryRow(ctx, `INSERT INTO paths(code,name) VALUES($1,'test') RETURNING id::text`, "HP"+suffix).Scan(&path); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO subjects(path_id,code,name) VALUES($1::uuid,'HS','test') RETURNING id::text`, path).Scan(&subject); err != nil {
		t.Fatal(err)
	}
	t.Run("question difficulty filters ignore case", func(t *testing.T) {
		tx, err := db.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		var id string
		if err = tx.QueryRow(ctx, `INSERT INTO questions(question_code,path_id,subject_id,workflow_status) VALUES($1,$2::uuid,$3::uuid,'approved') RETURNING id::text`, "EASY"+suffix, path, subject).Scan(&id); err != nil {
			t.Fatal(err)
		}
		if _, err = tx.Exec(ctx, `INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index,difficulty) VALUES($1::uuid,1,'mcq','easy question',0,'easy')`, id); err != nil {
			t.Fatal(err)
		}
		if err = tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		page, err := questionpg.New(db, nil).List(ctx, questiondomain.ListQuery{Page: 1, Limit: 20, PathID: path, SubjectID: subject, Difficulty: "Easy", WorkflowStatus: questiondomain.WorkflowApproved})
		if err != nil || len(page.Items) != 1 || page.Items[0].ID != id {
			t.Fatalf("case-insensitive difficulty failed: %+v %v", page, err)
		}
	})
	t.Run("path-level mock without a subject", func(t *testing.T) {
		repo := assessmentpg.New(db, operationspg.NewAuditWriter())
		strict, target, duration := true, 80.0, 3600
		service := assessmentapp.NewService(repo)
		created, err := service.Create(ctx, adminUser, assessmentdomain.Write{
			Code: "MOCK" + suffix, OwnerType: assessmentdomain.OwnerPlatform, IsVisible: true,
			Version: assessmentdomain.Version{Title: "محاكي المسار", PathID: path, Kind: assessmentdomain.KindMock, AccessType: assessmentdomain.AccessFree, MaxAttempts: 1, PassingScore: 50, TimeLimitSeconds: &duration, ShowAnswers: true, ShowExplanations: true, ShowResultsReport: true, RandomizeQuestions: true, RandomizeOptions: true, ShowProgressBar: true, RequireAnswerBeforeNext: true, AllowQuestionReview: true, OptionLayout: "auto", MockCategory: "qudrat", MockTargetScore: &target, MockStrictSectionLock: &strict, MockPresentationMode: "qiyas_strict", RevisionNote: "local test", Presentation: json.RawMessage(`{}`)},
		})
		if err != nil {
			t.Fatalf("path-level mock create: %v", err)
		}
		if created.Version.SubjectID != "" || created.Version.PathID != path {
			t.Fatalf("unexpected scope: %+v", created.Version)
		}
		v := created.Version
		if v.TimeLimitSeconds == nil || *v.TimeLimitSeconds != duration || !v.ShowAnswers || !v.ShowExplanations || !v.ShowResultsReport || !v.RandomizeQuestions || !v.RandomizeOptions || !v.ShowProgressBar || !v.RequireAnswerBeforeNext || !v.AllowQuestionReview || v.OptionLayout != "auto" || v.MockCategory != "qudrat" || v.MockTargetScore == nil || *v.MockTargetScore != target || v.MockStrictSectionLock == nil || !*v.MockStrictSectionLock || v.MockPresentationMode != "qiyas_strict" || v.RevisionNote != "local test" {
			t.Fatalf("saved assessment settings not returned: %+v", v)
		}
		var sectionID, questionID string
		if err := db.QueryRow(ctx, `SELECT uuidv7()::text`).Scan(&sectionID); err != nil {
			t.Fatal(err)
		}
		questionTx, err := db.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer questionTx.Rollback(ctx)
		if err = questionTx.QueryRow(ctx, `INSERT INTO questions(question_code) VALUES($1) RETURNING id::text`, "MOCKQ"+suffix).Scan(&questionID); err != nil {
			t.Fatal(err)
		}
		if _, err = questionTx.Exec(ctx, `INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index) VALUES($1,1,'mcq','test',0)`, questionID); err != nil {
			t.Fatal(err)
		}
		if err = questionTx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		write := assessmentdomain.Write{Code: created.Code, OwnerType: assessmentdomain.OwnerPlatform, IsVisible: true, Version: created.Version,
			Sections:  []assessmentdomain.Section{{ID: sectionID, Title: "القسم الأول", SubjectID: subject, SortOrder: 1, Domain: "general"}},
			Questions: []assessmentdomain.QuestionPlacement{{QuestionID: questionID, QuestionVersion: 1, SectionID: sectionID, SortOrder: 1, Points: 1}},
		}
		v2, err := service.Update(ctx, adminUser, created.ID, created.Revision, write)
		if err != nil {
			t.Fatalf("add section and question: %v", err)
		}
		write.Sections, write.Questions, write.Version = v2.Sections, v2.Questions, v2.Version
		v3, err := service.Update(ctx, adminUser, created.ID, v2.Revision, write)
		if err != nil {
			t.Fatalf("save a new version using existing section: %v", err)
		}
		if len(v3.Sections) != 1 || len(v3.Questions) != 1 || v3.Sections[0].ID == v2.Sections[0].ID || v3.Questions[0].SectionID != v3.Sections[0].ID {
			t.Fatalf("section mapping lost: v2=%+v v3=%+v", v2, v3)
		}
		var previousSection string
		if err := db.QueryRow(ctx, `SELECT section_id::text FROM assessment_version_questions WHERE assessment_id=$1::uuid AND assessment_version=2 AND question_id=$2::uuid`, created.ID, questionID).Scan(&previousSection); err != nil || previousSection != v2.Sections[0].ID {
			t.Fatalf("previous version changed: section=%s err=%v", previousSection, err)
		}
	})
	t.Run("normal assessment still requires a subject", func(t *testing.T) {
		repo := assessmentpg.New(db, operationspg.NewAuditWriter())
		service := assessmentapp.NewService(repo)
		_, err := service.Create(ctx, adminUser, assessmentdomain.Write{
			Code: "NORMAL" + suffix, OwnerType: assessmentdomain.OwnerPlatform,
			Version: assessmentdomain.Version{Title: "اختبار مادة", PathID: path, Kind: assessmentdomain.KindNormal, NormalMode: assessmentdomain.ModeExam, AccessType: assessmentdomain.AccessFree, MaxAttempts: 1, PassingScore: 50, OptionLayout: "auto", Presentation: json.RawMessage(`{}`)},
		})
		if err == nil {
			t.Fatal("normal assessment without subject must be rejected")
		}
	})
	t.Run("path-level author scope handles missing subject", func(t *testing.T) {
		teacher, err := identityRepo.CreateUser(ctx, "teacher", "teacher"+suffix+"@example.invalid", hash, identity.RoleTeacher)
		if err != nil {
			t.Fatal(err)
		}
		repo := assessmentpg.New(db, operationspg.NewAuditWriter())
		allowed, err := repo.CanAuthor(ctx, teacher.ID, path, "")
		if err != nil || allowed {
			t.Fatalf("unscoped teacher: allowed=%v err=%v", allowed, err)
		}
		if _, err := db.Exec(ctx, `INSERT INTO content_trainer_path_scopes(user_id,path_id,created_by) VALUES($1::uuid,$2::uuid,$3::uuid)`, teacher.ID, path, adminUser.ID); err != nil {
			t.Fatal(err)
		}
		allowed, err = repo.CanAuthor(ctx, teacher.ID, path, "")
		if err != nil || !allowed {
			t.Fatalf("path-scoped teacher: allowed=%v err=%v", allowed, err)
		}
	})
	t.Run("authenticated mock authoring over HTTP", func(t *testing.T) {
		strict, target, duration := true, 60.0, 3600
		var sectionID string
		if err := db.QueryRow(ctx, `SELECT uuidv7()::text`).Scan(&sectionID); err != nil {
			t.Fatal(err)
		}
		body, err := json.Marshal(map[string]any{
			"code": "HTTPMOCK" + suffix, "ownerType": "platform", "isVisible": true,
			"version":  assessmentdomain.Version{Title: "محاكي المسار", PathID: path, Kind: assessmentdomain.KindMock, AccessType: assessmentdomain.AccessFree, MaxAttempts: 1, PassingScore: 60, TimeLimitSeconds: &duration, OptionLayout: "auto", MockCategory: "qudrat", MockTargetScore: &target, MockStrictSectionLock: &strict, MockPresentationMode: "qiyas_strict", Presentation: json.RawMessage(`{}`)},
			"sections": []assessmentdomain.Section{{ID: sectionID, Title: "القسم الأول", SubjectID: subject, SortOrder: 1, Domain: "general"}}, "questions": []assessmentdomain.QuestionPlacement{},
		})
		if err != nil {
			t.Fatal(err)
		}
		h := assessmenthttp.New(assessmentapp.NewService(assessmentpg.New(db, operationspg.NewAuditWriter())), auth)
		call := func(token, csrf string) *httptest.ResponseRecorder {
			req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
			req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: token})
			req.Header.Set("X-CSRF-Token", csrf)
			w := httptest.NewRecorder()
			h.ServeHTTP(w, req)
			return w
		}
		if w := call(studentToken, studentCSRF); w.Code != http.StatusForbidden {
			t.Fatalf("student authoring: %d %s", w.Code, w.Body.String())
		}
		if w := call(adminToken, "invalid"); w.Code != http.StatusForbidden {
			t.Fatalf("invalid CSRF: %d %s", w.Code, w.Body.String())
		}
		w := call(adminToken, adminCSRF)
		if w.Code != http.StatusCreated {
			t.Fatalf("create: %d %s", w.Code, w.Body.String())
		}
		var result struct {
			Assessment assessmentdomain.Assessment `json:"assessment"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if result.Assessment.Version.SubjectID != "" || result.Assessment.Version.MockPresentationMode != "qiyas_strict" || len(result.Assessment.Sections) != 1 || result.Assessment.Sections[0].SubjectID != subject {
			t.Fatalf("scope/settings not preserved over HTTP: %+v", result.Assessment)
		}
	})
	t.Run("strict sections over HTTP and postgres", func(t *testing.T) {
		strict, target, seconds := true, 60.0, 600
		var sec1, sec2, q1, q2 string
		if err := db.QueryRow(ctx, `SELECT uuidv7()::text,uuidv7()::text`).Scan(&sec1, &sec2); err != nil {
			t.Fatal(err)
		}
		qtx, err := db.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer qtx.Rollback(ctx)
		for i, out := range []*string{&q1, &q2} {
			if err = qtx.QueryRow(ctx, `INSERT INTO questions(question_code) VALUES($1) RETURNING id::text`, fmt.Sprintf("STRICT%d%s", i, suffix)).Scan(out); err != nil {
				t.Fatal(err)
			}
			if _, err = qtx.Exec(ctx, `INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index) VALUES($1::uuid,1,'mcq',$2,0)`, *out, fmt.Sprintf("question %d", i)); err != nil {
				t.Fatal(err)
			}
			if _, err = qtx.Exec(ctx, `INSERT INTO question_options(question_id,version,option_index,option_text) VALUES($1::uuid,1,0,'answer')`, *out); err != nil {
				t.Fatal(err)
			}
		}
		if err = qtx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		repo := assessmentpg.New(db, operationspg.NewAuditWriter())
		service := assessmentapp.NewService(repo)
		write := assessmentdomain.Write{Code: "STRICT" + suffix, OwnerType: assessmentdomain.OwnerPlatform, IsVisible: true,
			Version:   assessmentdomain.Version{Title: "محاكي مقسم", PathID: path, Kind: assessmentdomain.KindMock, AccessType: assessmentdomain.AccessFree, MaxAttempts: 1, PassingScore: 60, ShowResultsReport: true, ShowAnswers: true, AllowQuestionReview: true, OptionLayout: "auto", MockCategory: "qudrat", MockTargetScore: &target, MockStrictSectionLock: &strict, MockPresentationMode: "qiyas_strict", Presentation: json.RawMessage(`{}`)},
			Sections:  []assessmentdomain.Section{{ID: sec1, Title: "الأول", SubjectID: subject, SortOrder: 1, TimeLimitSeconds: &seconds, Domain: "quantitative", StrictLock: true}, {ID: sec2, Title: "الثاني", SubjectID: subject, SortOrder: 2, TimeLimitSeconds: &seconds, Domain: "verbal", StrictLock: true}},
			Questions: []assessmentdomain.QuestionPlacement{{QuestionID: q1, QuestionVersion: 1, SectionID: sec1, SortOrder: 2, Points: 1}, {QuestionID: q2, QuestionVersion: 1, SectionID: sec2, SortOrder: 1, Points: 1}},
		}
		a, err := service.Create(ctx, adminUser, write)
		if err != nil {
			t.Fatal(err)
		}
		a, err = service.SetWorkflow(ctx, adminUser, a.ID, a.Revision, assessmentdomain.WorkflowPendingReview, "")
		if err != nil {
			t.Fatal(err)
		}
		a, err = service.SetWorkflow(ctx, adminUser, a.ID, a.Revision, assessmentdomain.WorkflowApproved, "")
		if err != nil {
			t.Fatal(err)
		}
		a, err = service.SetPublication(ctx, adminUser, a.ID, a.Revision, true)
		if err != nil {
			t.Fatal(err)
		}
		attemptService := assessmentapp.NewAttemptService(repo)
		// The legacy single-shot endpoint must not skip strict mock sections.
		quizHandler := assessmenthttp.NewQuizzes(nil, auth, attemptService)
		badCSRF := httptest.NewRequest(http.MethodPost, "/"+a.ID+"/submit", strings.NewReader(`{"submissionKey":"strict-csrf-`+suffix+`","answers":{}}`))
		badCSRF.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: studentToken})
		badCSRF.Header.Set("X-CSRF-Token", "invalid")
		badCSRFRes := httptest.NewRecorder()
		quizHandler.ServeHTTP(badCSRFRes, badCSRF)
		if badCSRFRes.Code != http.StatusForbidden || !strings.Contains(badCSRFRes.Body.String(), "Invalid CSRF") {
			t.Fatalf("single-shot accepted invalid CSRF: %d %s", badCSRFRes.Code, badCSRFRes.Body.String())
		}
		badAssessmentCSRF := httptest.NewRequest(http.MethodPost, "/"+a.ID+"/submit", strings.NewReader(`{"submissionKey":"assessment-csrf-`+suffix+`","answers":{}}`))
		badAssessmentCSRF.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: studentToken})
		badAssessmentCSRF.Header.Set("X-CSRF-Token", "invalid")
		badAssessmentCSRFRes := httptest.NewRecorder()
		assessmenthttp.NewWithDistribution(service, auth, nil, nil, attemptService).ServeHTTP(badAssessmentCSRFRes, badAssessmentCSRF)
		if badAssessmentCSRFRes.Code != http.StatusForbidden || !strings.Contains(badAssessmentCSRFRes.Body.String(), "Invalid CSRF") {
			t.Fatalf("assessment submit accepted invalid CSRF: %d %s", badAssessmentCSRFRes.Code, badAssessmentCSRFRes.Body.String())
		}
		quizReq := httptest.NewRequest(http.MethodPost, "/"+a.ID+"/submit", strings.NewReader(`{"submissionKey":"strict-bypass-`+suffix+`","answers":{}}`))
		quizReq.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: studentToken})
		quizReq.Header.Set("X-CSRF-Token", studentCSRF)
		quizRes := httptest.NewRecorder()
		quizHandler.ServeHTTP(quizRes, quizReq)
		if quizRes.Code != http.StatusForbidden {
			t.Fatalf("single-shot bypassed strict mock: %d %s", quizRes.Code, quizRes.Body.String())
		}
		paidWrite := assessmentdomain.Write{Code: "PAIDSINGLE" + suffix, OwnerType: assessmentdomain.OwnerPlatform, IsVisible: true,
			Version:   assessmentdomain.Version{Title: "اختبار مدفوع", PathID: path, SubjectID: subject, Kind: assessmentdomain.KindNormal, NormalMode: assessmentdomain.ModeExam, AccessType: assessmentdomain.AccessPaid, MaxAttempts: 1, PassingScore: 60, ShowResultsReport: true, OptionLayout: "auto", Presentation: json.RawMessage(`{}`)},
			Questions: []assessmentdomain.QuestionPlacement{{QuestionID: q1, QuestionVersion: 1, SortOrder: 1, Points: 1}},
		}
		paid, err := service.Create(ctx, adminUser, paidWrite)
		if err != nil {
			t.Fatal(err)
		}
		paid, err = service.SetWorkflow(ctx, adminUser, paid.ID, paid.Revision, assessmentdomain.WorkflowPendingReview, "")
		if err != nil {
			t.Fatal(err)
		}
		paid, err = service.SetWorkflow(ctx, adminUser, paid.ID, paid.Revision, assessmentdomain.WorkflowApproved, "")
		if err != nil {
			t.Fatal(err)
		}
		paid, err = service.SetPublication(ctx, adminUser, paid.ID, paid.Revision, true)
		if err != nil {
			t.Fatal(err)
		}
		commerceRepo := New(db, operationspg.NewAuditWriter())
		paidAttempts := assessmentapp.NewAttemptServiceWithLearningAndCommerce(repo, nil, commerceapp.NewService(commerceRepo, nil, nil, nil))
		paidHandler := assessmenthttp.NewQuizzes(nil, auth, paidAttempts)
		paidReq := httptest.NewRequest(http.MethodPost, "/"+paid.ID+"/submit", strings.NewReader(`{"submissionKey":"paid-bypass-`+suffix+`","answers":{}}`))
		paidReq.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: studentToken})
		paidReq.Header.Set("X-CSRF-Token", studentCSRF)
		paidRes := httptest.NewRecorder()
		paidHandler.ServeHTTP(paidRes, paidReq)
		if paidRes.Code != http.StatusForbidden {
			t.Fatalf("single-shot bypassed purchase: %d %s", paidRes.Code, paidRes.Body.String())
		}
		freeWrite := paidWrite
		freeWrite.Code = "PLACEDFREE" + suffix
		var placementSubject string
		if err = db.QueryRow(ctx, `INSERT INTO subjects(path_id,code,name) VALUES($1::uuid,$2,'اختبار العزل') RETURNING id::text`, path, "LOCK"+suffix).Scan(&placementSubject); err != nil {
			t.Fatal(err)
		}
		freeWrite.Version.SubjectID = placementSubject
		freeWrite.Version.AccessType = assessmentdomain.AccessFree
		placed, err := service.Create(ctx, adminUser, freeWrite)
		if err != nil {
			t.Fatal(err)
		}
		placed, err = service.SetWorkflow(ctx, adminUser, placed.ID, placed.Revision, assessmentdomain.WorkflowPendingReview, "")
		if err != nil {
			t.Fatal(err)
		}
		placed, err = service.SetWorkflow(ctx, adminUser, placed.ID, placed.Revision, assessmentdomain.WorkflowApproved, "")
		if err != nil {
			t.Fatal(err)
		}
		placed, err = service.SetPublication(ctx, adminUser, placed.ID, placed.Revision, true)
		if err != nil {
			t.Fatal(err)
		}
		_, err = repo.CreatePlacement(ctx, adminUser.ID, placed.ID, assessmentdomain.PlacementWrite{Slot: assessmentdomain.PlacementTraining, AccessType: assessmentdomain.PlacementAccessPackage, PathID: path, SubjectID: placementSubject, IsVisible: true})
		if err != nil {
			t.Fatal(err)
		}
		if _, err = paidAttempts.Start(ctx, studentUser, placed.ID, "placement-direct-"+suffix); !errors.Is(err, assessmentapp.ErrForbidden) {
			t.Fatalf("direct start bypassed locked placement: %v", err)
		}
		assessHandler := assessmenthttp.NewWithDistribution(service, auth, nil, nil, paidAttempts)
		directReq := httptest.NewRequest(http.MethodPost, "/"+placed.ID+"/attempts", strings.NewReader(`{"startKey":"placement-http-`+suffix+`"}`))
		directReq.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: studentToken})
		directReq.Header.Set("X-CSRF-Token", studentCSRF)
		directRes := httptest.NewRecorder()
		assessHandler.ServeHTTP(directRes, directReq)
		if directRes.Code != http.StatusForbidden {
			t.Fatalf("HTTP start bypassed locked placement: %d %s", directRes.Code, directRes.Body.String())
		}
		placedReq := httptest.NewRequest(http.MethodPost, "/"+placed.ID+"/submit", strings.NewReader(`{"submissionKey":"placement-bypass-`+suffix+`","answers":{}}`))
		placedReq.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: studentToken})
		placedReq.Header.Set("X-CSRF-Token", studentCSRF)
		placedRes := httptest.NewRecorder()
		paidHandler.ServeHTTP(placedRes, placedReq)
		if placedRes.Code != http.StatusForbidden {
			t.Fatalf("single-shot bypassed locked placement: %d %s", placedRes.Code, placedRes.Body.String())
		}
		_, err = repo.CreatePlacement(ctx, adminUser.ID, placed.ID, assessmentdomain.PlacementWrite{Slot: assessmentdomain.PlacementTests, AccessType: assessmentdomain.PlacementAccessFree, PathID: path, SubjectID: placementSubject, IsVisible: true})
		if err != nil {
			t.Fatal(err)
		}
		if _, err = paidAttempts.Start(ctx, studentUser, placed.ID, "free-placement-"+suffix); err != nil {
			t.Fatalf("free placement should allow direct start: %v", err)
		}
		freeReq := httptest.NewRequest(http.MethodPost, "/"+placed.ID+"/submit", strings.NewReader(`{"submissionKey":"free-placement-submit-`+suffix+`","answers":{}}`))
		freeReq.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: studentToken})
		freeReq.Header.Set("X-CSRF-Token", studentCSRF)
		freeRes := httptest.NewRecorder()
		paidHandler.ServeHTTP(freeRes, freeReq)
		if freeRes.Code != http.StatusCreated {
			t.Fatalf("free placement should allow submission: %d %s", freeRes.Code, freeRes.Body.String())
		}
		// Keep this scenario's package-only placement out of the parent study-plan fixture.
		if _, err = db.Exec(ctx, `DELETE FROM assessment_learning_placements WHERE assessment_id=$1::uuid`, placed.ID); err != nil {
			t.Fatal(err)
		}
		attempt, err := attemptService.Start(ctx, studentUser, a.ID, "strict-start-"+suffix)
		if err != nil {
			t.Fatal(err)
		}
		if len(attempt.Questions) != 1 || attempt.Questions[0].ID != q1 || attempt.TotalQuestions != 2 {
			t.Fatalf("first section leaked or count wrong: %+v", attempt)
		}
		h := assessmenthttp.NewAttempts(attemptService, auth)
		call := func(method, route, token, csrf, body string) *httptest.ResponseRecorder {
			req := httptest.NewRequest(method, route, strings.NewReader(body))
			req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: token})
			req.Header.Set("X-CSRF-Token", csrf)
			w := httptest.NewRecorder()
			h.ServeHTTP(w, req)
			return w
		}
		if w := call(http.MethodPut, "/"+attempt.ID+"/answers/"+q2, studentToken, studentCSRF, `{"selectedOptionIndex":0}`); w.Code != http.StatusConflict {
			t.Fatalf("future answer: %d %s", w.Code, w.Body.String())
		}
		advance := "/" + attempt.ID + "/sections/advance"
		body := `{"expectedSectionId":"` + sec1 + `"}`
		if w := call(http.MethodPost, advance, studentToken, "invalid", body); w.Code != http.StatusForbidden {
			t.Fatalf("CSRF: %d %s", w.Code, w.Body.String())
		}
		if w := call(http.MethodPost, advance, adminToken, adminCSRF, body); w.Code != http.StatusForbidden {
			t.Fatalf("admin advancing student: %d %s", w.Code, w.Body.String())
		}
		w := call(http.MethodPost, advance, studentToken, studentCSRF, body)
		if w.Code != http.StatusOK {
			t.Fatalf("advance: %d %s", w.Code, w.Body.String())
		}
		var response struct {
			Attempt assessmentdomain.Attempt `json:"attempt"`
		}
		if err = json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		if response.Attempt.SectionProgress == nil || response.Attempt.SectionProgress.CurrentSectionID != sec2 || len(response.Attempt.Questions) != 1 || response.Attempt.Questions[0].ID != q2 {
			t.Fatalf("wrong second section: %+v", response.Attempt)
		}
		if w = call(http.MethodPut, "/"+attempt.ID+"/answers/"+q1, studentToken, studentCSRF, `{"selectedOptionIndex":0}`); w.Code != http.StatusConflict {
			t.Fatalf("previous answer: %d %s", w.Code, w.Body.String())
		}
		w = call(http.MethodPost, advance, studentToken, studentCSRF, body)
		if w.Code != http.StatusOK {
			t.Fatalf("retry: %d %s", w.Code, w.Body.String())
		}
		answerRoute := "/" + attempt.ID + "/answers/" + q2
		if w = call(http.MethodPut, answerRoute, studentToken, studentCSRF, `{"selectedOptionIndex":0}`); w.Code != http.StatusOK {
			t.Fatalf("save before expiry: %d %s", w.Code, w.Body.String())
		}
		if _, err = db.Exec(ctx, `UPDATE assessment_attempts SET started_at=now()-interval '2 minutes',expires_at=now()-interval '1 minute' WHERE id=$1::uuid`, attempt.ID); err != nil {
			t.Fatal(err)
		}
		if w = call(http.MethodPut, answerRoute, studentToken, studentCSRF, `{"selectedOptionIndex":0}`); w.Code != http.StatusConflict {
			t.Fatalf("answer accepted after expiry: %d %s", w.Code, w.Body.String())
		}
		w = call(http.MethodPost, "/"+attempt.ID+"/submit", studentToken, studentCSRF, `{"submissionKey":"expired-submit-`+suffix+`"}`)
		if w.Code != http.StatusOK {
			t.Fatalf("expired submit failed: %d %s", w.Code, w.Body.String())
		}
		var timedOut struct {
			Result assessmentdomain.Result `json:"result"`
		}
		if err = json.Unmarshal(w.Body.Bytes(), &timedOut); err != nil || timedOut.Result.Score != 50 || timedOut.Result.CorrectAnswers != 1 || timedOut.Result.Unanswered != 1 {
			t.Fatalf("expired score lost saved answers: %+v err=%v", timedOut.Result, err)
		}
		if os.Getenv("ASSESSMENT_JOURNEY_BROWSER") == "1" {
			var timedSec1, timedSec2 string
			if err = db.QueryRow(ctx, `SELECT uuidv7()::text,uuidv7()::text`).Scan(&timedSec1, &timedSec2); err != nil {
				t.Fatal(err)
			}
			timedWrite := write
			timedWrite.Code = "TIMED" + suffix
			timedWrite.Version.Title = "محاكي بوقت قصير"
			timedSeconds := 3
			timedWrite.Version.TimeLimitSeconds = &timedSeconds
			timedWrite.Sections = append([]assessmentdomain.Section(nil), write.Sections...)
			timedWrite.Questions = append([]assessmentdomain.QuestionPlacement(nil), write.Questions...)
			timedWrite.Sections[0].ID, timedWrite.Sections[1].ID = timedSec1, timedSec2
			timedWrite.Questions[0].SectionID, timedWrite.Questions[1].SectionID = timedSec1, timedSec2
			timedAssessment, e := service.Create(ctx, adminUser, timedWrite)
			if e != nil {
				t.Fatal(e)
			}
			timedAssessment, e = service.SetWorkflow(ctx, adminUser, timedAssessment.ID, timedAssessment.Revision, assessmentdomain.WorkflowPendingReview, "")
			if e != nil {
				t.Fatal(e)
			}
			timedAssessment, e = service.SetWorkflow(ctx, adminUser, timedAssessment.ID, timedAssessment.Revision, assessmentdomain.WorkflowApproved, "")
			if e != nil {
				t.Fatal(e)
			}
			timedAssessment, e = service.SetPublication(ctx, adminUser, timedAssessment.ID, timedAssessment.Revision, true)
			if e != nil {
				t.Fatal(e)
			}
			paidMockWrite := write
			paidMockWrite.Code = "BROWSERPAID" + suffix
			paidMockWrite.Version.Title = "محاكي مدفوع للتجربة"
			paidMockWrite.Version.AccessType = assessmentdomain.AccessPaid
			paidMockWrite.Version.MockPresentationMode = "flexible"
			flexibleLock := false
			paidMockWrite.Version.MockStrictSectionLock = &flexibleLock
			paidMockWrite.Sections = nil
			paidMockWrite.Questions = append([]assessmentdomain.QuestionPlacement(nil), write.Questions...)
			for i := range paidMockWrite.Questions {
				paidMockWrite.Questions[i].SectionID = ""
			}
			paidMock, e := service.Create(ctx, adminUser, paidMockWrite)
			if e != nil {
				t.Fatal(e)
			}
			paidMock, e = service.SetWorkflow(ctx, adminUser, paidMock.ID, paidMock.Revision, assessmentdomain.WorkflowPendingReview, "")
			if e != nil {
				t.Fatal(e)
			}
			paidMock, e = service.SetWorkflow(ctx, adminUser, paidMock.ID, paidMock.Revision, assessmentdomain.WorkflowApproved, "")
			if e != nil {
				t.Fatal(e)
			}
			paidMock, e = service.SetPublication(ctx, adminUser, paidMock.ID, paidMock.Revision, true)
			if e != nil {
				t.Fatal(e)
			}
			browserStudent, e := identityRepo.CreateUser(ctx, "exam browser", "exambrowser"+suffix+"@example.invalid", hash, identity.RoleStudent)
			if e != nil {
				t.Fatal(e)
			}
			router := chi.NewRouter()
			router.Mount("/api/v1/auth", identityhttp.New(auth, false))
			router.Mount("/api/v1/taxonomy", taxonomyhttp.New(taxonomyapp.NewService(taxonomypg.New(db)), auth))
			router.Mount("/api/v1/learning/navigation-preferences", navigation.NewHandler(navigation.NewService(navigation.NewPostgres(db)), auth))
			router.Mount("/api/v1/public/mock-exams", assessmentcatalog.NewHandler(assessmentcatalog.NewService(assessmentcatalog.NewPostgres(db))))
			router.Mount("/api/v1/assessments", assessmenthttp.New(service, auth, paidAttempts))
			router.Mount("/api/v1/assessment-attempts", h)
			server := httptest.NewServer(router)
			defer server.Close()
			web, e := filepath.Abs("../../../../apps/web")
			if e != nil {
				t.Fatal(e)
			}
			command := exec.CommandContext(ctx, "node", "node_modules/@playwright/test/cli.js", "test", "tests/e2e/assessment-live-journey.spec.ts", "--project=chromium", "--workers=1", "--output=test-results/assessment-live")
			command.Dir = web
			command.Env = append(os.Environ(), "CI=1", "EXAM_LIVE=1", "E2E_WEB_PORT=4266", "E2E_API_TARGET="+server.URL, "EXAM_STUDENT_EMAIL="+browserStudent.Email, "EXAM_ADMIN_EMAIL="+adminUser.Email, "EXAM_PASSWORD="+password, "EXAM_ASSESSMENT_ID="+a.ID, "EXAM_TIMED_ASSESSMENT_ID="+timedAssessment.ID, "EXAM_PATH_ID="+path)
			output, e := command.CombinedOutput()
			t.Log(string(output))
			if e != nil {
				t.Fatalf("isolated browser assessment journey: %v", e)
			}
		}
	})
	// Exercise actual taxonomy HTTP, authentication and migrated PostgreSQL tables.
	var deletePath, deleteLevel, deleteSubject, childPath string
	if err = db.QueryRow(ctx, `INSERT INTO paths(code,name) VALUES($1,'delete test') RETURNING id::text`, "DEL"+suffix).Scan(&deletePath); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO paths(code,name,parent_path_id) VALUES($1,'child test',$2) RETURNING id::text`, "CHILD"+suffix, deletePath).Scan(&childPath); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO levels(path_id,code,name) VALUES($1,'DEL-L','delete test') RETURNING id::text`, deletePath).Scan(&deleteLevel); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO subjects(path_id,level_id,code,name) VALUES($1,$2,'DEL-S','delete test') RETURNING id::text`, deletePath, deleteLevel).Scan(&deleteSubject); err != nil {
		t.Fatal(err)
	}
	var publicCourse string
	var visibleTopic, visibleLesson, visibleModule string
	searchTitle := "visibilitycourse" + suffix
	if err = db.QueryRow(ctx, `INSERT INTO courses(path_id,subject_id,title,workflow_status,is_published,is_visible,owner_type) VALUES($1,$2,$3,'approved',true,true,'platform') RETURNING id::text`, deletePath, deleteSubject, searchTitle).Scan(&publicCourse); err != nil {
		t.Fatal(err)
	}
	contentReader := contentpg.New(db, operationspg.NewAuditWriter())
	if err = db.QueryRow(ctx, `INSERT INTO foundation_topics(path_id,subject_id,code,title,status,is_visible,created_by) VALUES($1,$2,$3,'visibility topic','active',true,$4) RETURNING id::text`, deletePath, deleteSubject, "VT"+suffix, adminUser.ID).Scan(&visibleTopic); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO lessons(path_id,subject_id,title,lesson_type,content_text,workflow_status,is_visible,owner_type,created_by,approved_by,approved_at) VALUES($1,$2,'visibility lesson','text','test','approved',true,'platform',$3,$3,now()) RETURNING id::text`, deletePath, deleteSubject, adminUser.ID).Scan(&visibleLesson); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO course_modules(course_id,title) VALUES($1,'visibility module') RETURNING id::text`, publicCourse).Scan(&visibleModule); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO topic_lessons(topic_id,lesson_id) VALUES($1,$2)`, visibleTopic, visibleLesson); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO course_lessons(module_id,lesson_id,is_preview) VALUES($1,$2,true)`, visibleModule, visibleLesson); err != nil {
		t.Fatal(err)
	}
	assertCourseSearch := func(want bool) {
		rows, err := contentReader.SearchPublicCourses(ctx, searchTitle, 20)
		if err != nil {
			t.Fatalf("public course search: %v", err)
		}
		found := false
		for _, row := range rows {
			if row.ID == publicCourse {
				found = true
			}
		}
		if found != want {
			t.Fatalf("public course search visible=%v want %v", found, want)
		}
		courses, err := contentReader.ListPublicCourses(ctx, 100)
		if err != nil {
			t.Fatalf("public courses: %v", err)
		}
		found = false
		for _, row := range courses {
			if row.ID == publicCourse {
				found = true
			}
		}
		if found != want {
			t.Fatalf("public courses visible=%v want %v", found, want)
		}
	}
	assertCourseSearch(true)
	taxonomyHandler := taxonomyhttp.New(taxonomyapp.NewService(taxonomypg.New(db)), auth)
	setVisibility := func(route string, visible bool) {
		payload, _ := json.Marshal(map[string]bool{"isVisible": visible})
		req := httptest.NewRequest(http.MethodPatch, "/admin/"+route, bytes.NewReader(payload))
		req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: adminToken})
		req.Header.Set("X-CSRF-Token", adminCSRF)
		result := httptest.NewRecorder()
		taxonomyHandler.ServeHTTP(result, req)
		if result.Code != http.StatusOK {
			t.Fatalf("visibility %s: %d %s", route, result.Code, result.Body.String())
		}
	}
	assertPublic := func(id string, visible bool) {
		result := httptest.NewRecorder()
		taxonomyHandler.ServeHTTP(result, httptest.NewRequest(http.MethodGet, "/bootstrap", nil))
		if result.Code != http.StatusOK || bytes.Contains(result.Body.Bytes(), []byte(id)) != visible {
			t.Fatalf("public visibility %s=%v status %d", id, visible, result.Code)
		}
	}
	for _, item := range []struct{ route, id string }{{"subjects/" + deleteSubject, deleteSubject}, {"levels/" + deleteLevel, deleteLevel}, {"paths/" + deletePath, deletePath}} {
		setVisibility(item.route, false)
		assertPublic(item.id, false)
		assertCourseSearch(false)
		studyResources, err := contentReader.ListStudyPlanResources(ctx, deletePath, []string{deleteSubject}, nil, 50)
		if err != nil || len(studyResources) != 0 {
			t.Fatalf("hidden content study plan resources %s: %+v %v", item.route, studyResources, err)
		}
		visibleToLearner, err := contentReader.LearnerAssessmentScopeVisible(ctx, deletePath, deleteSubject)
		if err != nil || visibleToLearner {
			t.Fatalf("hidden assessment scope %s: %v %v", item.route, visibleToLearner, err)
		}
		for _, target := range []struct{ slot, course, topic string }{{"training", "", ""}, {"tests", "", ""}, {"foundation", "", visibleTopic}, {"course", publicCourse, ""}} {
			valid, err := contentReader.ValidateAssessmentPlacementTarget(ctx, target.slot, deletePath, deleteSubject, target.course, "", target.topic)
			if err != nil || !valid {
				t.Fatalf("admin must be able to prepare hidden %s: %v %v", target.slot, valid, err)
			}
		}
		if _, err := contentReader.GetLearningSpace(ctx, deletePath, deleteSubject, 50); err == nil {
			t.Fatalf("hidden %s remains reachable as learning space", item.route)
		}
		if _, err := contentReader.GetLearnerCourse(ctx, publicCourse); err == nil {
			t.Fatalf("hidden %s course remains reachable", item.route)
		}
		if _, err := contentReader.GetLearnerTopic(ctx, visibleTopic); err == nil {
			t.Fatalf("hidden %s topic remains reachable", item.route)
		}
		if _, err := contentReader.GetLearnerFoundationLesson(ctx, visibleTopic, visibleLesson); err == nil {
			t.Fatalf("hidden %s foundation lesson remains reachable", item.route)
		}
		if _, err := contentReader.GetLearnerCourseLesson(ctx, publicCourse, visibleLesson); err == nil {
			t.Fatalf("hidden %s course lesson remains reachable", item.route)
		}
		if item.id == deletePath {
			assertPublic(childPath, false)
		}
		if item.id == deletePath || item.id == deleteLevel {
			assertPublic(deleteSubject, false)
		}
		visible, scopeErr := taxonomypg.New(db).PublicCommerceScopeVisible(ctx, deletePath, deleteSubject)
		if scopeErr != nil || visible {
			t.Fatalf("hidden public commerce scope %s: %v %v", item.route, visible, scopeErr)
		}
		setVisibility(item.route, true)
		assertPublic(item.id, true)
		assertCourseSearch(true)
		studyResources, err = contentReader.ListStudyPlanResources(ctx, deletePath, []string{deleteSubject}, nil, 50)
		if err != nil || len(studyResources) != 1 || studyResources[0].ID != visibleLesson {
			t.Fatalf("restored content study plan resources %s: %+v %v", item.route, studyResources, err)
		}
		visibleToLearner, err = contentReader.LearnerAssessmentScopeVisible(ctx, deletePath, deleteSubject)
		if err != nil || !visibleToLearner {
			t.Fatalf("restored assessment scope %s: %v %v", item.route, visibleToLearner, err)
		}
		if _, err := contentReader.GetLearningSpace(ctx, deletePath, deleteSubject, 50); err != nil {
			t.Fatalf("restored %s learning space: %v", item.route, err)
		}
		if _, err := contentReader.GetLearnerCourse(ctx, publicCourse); err != nil {
			t.Fatalf("restored %s course: %v", item.route, err)
		}
		if _, err := contentReader.GetLearnerTopic(ctx, visibleTopic); err != nil {
			t.Fatalf("restored %s topic: %v", item.route, err)
		}
		if _, err := contentReader.GetLearnerFoundationLesson(ctx, visibleTopic, visibleLesson); err != nil {
			t.Fatalf("restored %s foundation lesson: %v", item.route, err)
		}
		if _, err := contentReader.GetLearnerCourseLesson(ctx, publicCourse, visibleLesson); err != nil {
			t.Fatalf("restored %s course lesson: %v", item.route, err)
		}
		visible, scopeErr = taxonomypg.New(db).PublicCommerceScopeVisible(ctx, deletePath, deleteSubject)
		if scopeErr != nil || !visible {
			t.Fatalf("restored public commerce scope %s: %v %v", item.route, visible, scopeErr)
		}
	}
	setStatus := func(status string) {
		payload, _ := json.Marshal(map[string]string{"status": status})
		req := httptest.NewRequest(http.MethodPatch, "/admin/subjects/"+deleteSubject, bytes.NewReader(payload))
		req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: adminToken})
		req.Header.Set("X-CSRF-Token", adminCSRF)
		result := httptest.NewRecorder()
		taxonomyHandler.ServeHTTP(result, req)
		if result.Code != http.StatusOK {
			t.Fatalf("subject status %s: %d", status, result.Code)
		}
	}
	setStatus("archived")
	setVisibility("subjects/"+deleteSubject, false)
	setVisibility("subjects/"+deleteSubject, true)
	assertPublic(deleteSubject, false)
	setStatus("active")
	assertPublic(deleteSubject, true)
	deleteRecord := func(route, token, csrf string) int {
		req := httptest.NewRequest(http.MethodDelete, "/admin/"+route, nil)
		req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: token})
		req.Header.Set("X-CSRF-Token", csrf)
		result := httptest.NewRecorder()
		taxonomyHandler.ServeHTTP(result, req)
		return result.Code
	}
	if got := deleteRecord("paths/"+deletePath, studentToken, studentCSRF); got != http.StatusForbidden {
		t.Fatalf("student delete: %d", got)
	}
	if got := deleteRecord("paths/"+deletePath, adminToken, adminCSRF); got != http.StatusConflict {
		t.Fatalf("path with dependents: %d", got)
	}
	if _, err = db.Exec(ctx, `DELETE FROM topic_lessons WHERE topic_id=$1`, visibleTopic); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM course_lessons WHERE module_id=$1`, visibleModule); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM course_modules WHERE id=$1`, visibleModule); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM lessons WHERE id=$1`, visibleLesson); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM courses WHERE id=$1`, publicCourse); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM foundation_topics WHERE id=$1`, visibleTopic); err != nil {
		t.Fatal(err)
	}
	for _, route := range []string{"subjects/" + deleteSubject, "levels/" + deleteLevel, "paths/" + childPath, "paths/" + deletePath} {
		if got := deleteRecord(route, adminToken, adminCSRF); got != http.StatusOK {
			t.Fatalf("delete %s: %d", route, got)
		}
	}
	repo := New(db, operationspg.NewAuditWriter())
	service := commerceapp.NewService(repo, nil, taxonomypg.New(db), nil)
	checkout := commerceapp.NewCheckoutService(repo, commerce.CheckoutPolicy{GatewayMode: commerce.GatewayManualReview, ProviderCode: "manual"})
	accessService := commerceapp.NewAccessService(repo, repo, nil)
	h := commercehttp.NewWithAccess(service, checkout, accessService, auth, nil)
	call := func(method, path, token, csrf string, body any) *httptest.ResponseRecorder {
		t.Helper()
		b, e := json.Marshal(body)
		if e != nil {
			t.Fatal(e)
		}
		req := httptest.NewRequest(method, path, bytes.NewReader(b))
		if token != "" {
			req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: token})
		}
		req.Header.Set("X-CSRF-Token", csrf)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		return w
	}
	write := commerce.ProductWrite{Code: "HTTP" + suffix, ProductType: commerce.ProductPackage, Name: "باقة تدريب", Status: commerce.ProductActive, AccessMode: commerce.AccessPaid, PriceMinor: 1200, Currency: "SAR", IsVisible: true, Package: &commerce.PackageWrite{PackageKind: commerce.PackageBundle, Items: []commerce.PackageItem{{ScopeType: commerce.ScopeSubject, SubjectID: subject, ContentType: commerce.ContentBanks}}}}
	write.Package.Items = append(write.Package.Items, commerce.PackageItem{ScopeType: commerce.ScopeSubject, SubjectID: subject, ContentType: commerce.ContentFoundation})
	if w := call(http.MethodPost, "/products", studentToken, studentCSRF, write); w.Code != http.StatusForbidden {
		t.Fatalf("student product create %d: %s", w.Code, w.Body.String())
	}
	if w := call(http.MethodPost, "/products", adminToken, "bad", write); w.Code != http.StatusForbidden {
		t.Fatalf("bad csrf %d", w.Code)
	}
	w := call(http.MethodPost, "/products", adminToken, adminCSRF, write)
	if w.Code != http.StatusCreated {
		t.Fatalf("create product %d: %s", w.Code, w.Body.String())
	}
	var product struct {
		Product commerce.Product `json:"product"`
	}
	if err = json.Unmarshal(w.Body.Bytes(), &product); err != nil {
		t.Fatal(err)
	}
	w = call(http.MethodGet, "/products?productType=package", adminToken, adminCSRF, nil)
	var listed commerce.ProductPage
	if err = json.Unmarshal(w.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	listedScope := false
	for _, item := range listed.Items {
		if item.ID == product.Product.ID && item.Package != nil && len(item.Package.Items) == 2 {
			listedScope = true
		}
	}
	if !listedScope {
		t.Fatal("admin package listing must include both scope items")
	}
	w = call(http.MethodGet, "/catalog/products?pathId="+path, "", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("public catalog %d: %s", w.Code, w.Body.String())
	}
	var catalog struct {
		Items []commerce.PublicProduct `json:"items"`
	}
	if err = json.Unmarshal(w.Body.Bytes(), &catalog); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, item := range catalog.Items {
		if item.ID != product.Product.ID {
			continue
		}
		found = true
		if item.ProductType != commerce.ProductPackage {
			t.Fatalf("package incorrectly classified: %+v", item)
		}
		kinds := map[commerce.ContentType]bool{}
		for _, kind := range item.ContentTypes {
			kinds[kind] = true
		}
		if !kinds[commerce.ContentBanks] || !kinds[commerce.ContentFoundation] || kinds[commerce.ContentAll] {
			t.Fatalf("incorrect visible package contents: %+v", item.ContentTypes)
		}
	}
	if !found {
		t.Fatal("package missing from its public path catalog")
	}
	create := commerce.CheckoutCreate{ProductID: product.Product.ID, PaymentMethod: commerce.PaymentTransfer, IdempotencyKey: "http-" + suffix}
	if w = call(http.MethodPost, "/checkout/requests", "", "", create); w.Code != http.StatusUnauthorized {
		t.Fatalf("guest checkout %d", w.Code)
	}
	w = call(http.MethodPost, "/checkout/requests", studentToken, studentCSRF, create)
	if w.Code != http.StatusCreated {
		t.Fatalf("checkout %d: %s", w.Code, w.Body.String())
	}
	var out struct {
		Request commerce.PaymentRequest `json:"request"`
	}
	if err = json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	review := commerce.PaymentReview{ExpectedRevision: out.Request.Revision, Status: commerce.PaymentPaid, ApprovalEvidence: "test transfer"}
	reviewPath := "/admin/payment-requests/" + out.Request.ID + "/review"
	if w = call(http.MethodPatch, reviewPath, studentToken, studentCSRF, review); w.Code != http.StatusForbidden {
		t.Fatalf("student review %d: %s", w.Code, w.Body.String())
	}
	before, e := repo.ResolveScopedAccess(ctx, student, nil, path, subject, "", commerce.ContentBanks, true)
	if e != nil || before.Allowed {
		t.Fatalf("before payment %+v %v", before, e)
	}
	if w = call(http.MethodPatch, reviewPath, adminToken, adminCSRF, review); w.Code != http.StatusOK {
		t.Fatalf("admin review %d: %s", w.Code, w.Body.String())
	}
	after, e := repo.ResolveScopedAccess(ctx, student, nil, path, subject, "", commerce.ContentBanks, true)
	if e != nil || !after.Allowed {
		t.Fatalf("after payment %+v %v", after, e)
	}
	write.IsVisible = false
	update := map[string]any{"expectedRevision": product.Product.Revision, "product": write}
	w = call(http.MethodPut, "/products/"+product.Product.ID, adminToken, adminCSRF, update)
	if w.Code != http.StatusOK {
		t.Fatalf("hide package %d: %s", w.Code, w.Body.String())
	}
	w = call(http.MethodGet, "/catalog/products?pathId="+path, "", "", nil)
	if err = json.Unmarshal(w.Body.Bytes(), &catalog); err != nil {
		t.Fatal(err)
	}
	for _, item := range catalog.Items {
		if item.ID == product.Product.ID {
			t.Fatal("hidden package is visible in public catalog")
		}
	}
	hiddenAccess, e := repo.ResolveScopedAccess(ctx, student, nil, path, subject, "", commerce.ContentBanks, true)
	if e != nil || !hiddenAccess.Allowed {
		t.Fatalf("hiding package must preserve purchased access: %+v %v", hiddenAccess, e)
	}
	w = call(http.MethodGet, "/products/"+product.Product.ID, adminToken, adminCSRF, nil)
	if err = json.Unmarshal(w.Body.Bytes(), &product); err != nil || product.Product.Package == nil || len(product.Product.Package.Items) != 2 {
		t.Fatalf("hidden package must retain its scopes: %s, %v", w.Body.String(), err)
	}
	write.IsVisible = true
	update = map[string]any{"expectedRevision": product.Product.Revision, "product": write}
	w = call(http.MethodPut, "/products/"+product.Product.ID, adminToken, adminCSRF, update)
	if w.Code != http.StatusOK {
		t.Fatalf("show package %d: %s", w.Code, w.Body.String())
	}
	w = call(http.MethodGet, "/catalog/products?pathId="+path, "", "", nil)
	if err = json.Unmarshal(w.Body.Bytes(), &catalog); err != nil {
		t.Fatal(err)
	}
	found = false
	for _, item := range catalog.Items {
		found = found || item.ID == product.Product.ID
	}
	if !found {
		t.Fatal("restored package missing from public catalog")
	}
	training, e := service.CheckAssessmentAccess(ctx, student, path, subject, "", commerce.ContentBanks, true)
	if e != nil || !training.Allowed {
		t.Fatalf("training service after payment %+v %v", training, e)
	}
	foundation, e := service.CheckAssessmentAccess(ctx, student, path, subject, "", commerce.ContentFoundation, true)
	if e != nil || !foundation.Allowed {
		t.Fatalf("foundation assessment after payment %+v %v", foundation, e)
	}
	library, e := service.CheckLibraryAccess(ctx, student, path, subject)
	if e != nil || library.Allowed {
		t.Fatalf("uncovered library %+v %v", library, e)
	}
	wrong, e := repo.ResolveScopedAccess(ctx, student, nil, path, subject, "", commerce.ContentTests, true)
	if e != nil || wrong.Allowed {
		t.Fatalf("wrong content %+v %v", wrong, e)
	}
	noSubject, e := repo.ResolveScopedAccess(ctx, student, nil, path, "", "", commerce.ContentMockExams, true)
	if e != nil || noSubject.Allowed {
		t.Fatalf("subject-scoped package must not grant a path-wide mock: %+v %v", noSubject, e)
	}
	// Real learner placement and attempts: hiding blocks new starts but leaves
	// existing attempts retrievable; restoring visibility permits another start.
	var assessID, questionID, placementID string
	assessmentTx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer assessmentTx.Rollback(ctx)
	if err = assessmentTx.QueryRow(ctx, `INSERT INTO assessments(assessment_code,owner_type,workflow_status,is_published,is_visible,published_version) VALUES($1,'platform','approved',true,true,1) RETURNING id::text`, "VIS"+suffix).Scan(&assessID); err != nil {
		t.Fatal(err)
	}
	if _, err = assessmentTx.Exec(ctx, `INSERT INTO assessment_versions(assessment_id,version,title,path_id,subject_id,assessment_kind,normal_mode,version_status,published_at,max_attempts) VALUES($1,1,'visibility assessment',$2,$3,'normal','practice','published',now(),3)`, assessID, path, subject); err != nil {
		t.Fatal(err)
	}
	if err = assessmentTx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	questionTx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer questionTx.Rollback(ctx)
	if err = questionTx.QueryRow(ctx, `INSERT INTO questions(question_code) VALUES($1) RETURNING id::text`, "VISQ"+suffix).Scan(&questionID); err != nil {
		t.Fatal(err)
	}
	if _, err = questionTx.Exec(ctx, `INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index) VALUES($1,1,'mcq','test question',0)`, questionID); err != nil {
		t.Fatal(err)
	}
	if err = questionTx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO question_options(question_id,version,option_index,option_text) VALUES($1,1,0,'answer')`, questionID); err != nil {
		t.Fatal(err)
	}
	t.Run("purchased placement submission retry after access expires", func(t *testing.T) {
		var id string
		tx, err := db.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		if err := tx.QueryRow(ctx, `INSERT INTO assessments(assessment_code,owner_type,workflow_status,is_published,is_visible,published_version) VALUES($1,'platform','approved',true,true,1) RETURNING id::text`, "RETRY"+suffix).Scan(&id); err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO assessment_versions(assessment_id,version,title,path_id,subject_id,assessment_kind,normal_mode,version_status,published_at,max_attempts,show_results_report) VALUES($1,1,'retry assessment',$2,$3,'normal','practice','published',now(),2,true)`, id, path, subject); err != nil {
			t.Fatal(err)
		}
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(ctx, `INSERT INTO assessment_version_questions(assessment_id,assessment_version,question_id,question_version) VALUES($1,1,$2,1)`, id, questionID); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(ctx, `INSERT INTO assessment_learning_placements(assessment_id,assessment_version,slot,access_type,path_id,subject_id,is_visible) VALUES($1,1,'training','package',$2,$3,true)`, id, path, subject); err != nil {
			t.Fatal(err)
		}
		attemptRepo := assessmentpg.New(db, operationspg.NewAuditWriter())
		attempts := assessmentapp.NewAttemptServiceWithLearningAndCommerce(attemptRepo, nil, service)
		handler := assessmenthttp.NewQuizzes(nil, auth, attempts)
		accessHandler := assessmenthttp.NewWithDistribution(nil, auth, nil, nil, attempts)
		checkAccess := func(token string, want bool, reason string) {
			req := httptest.NewRequest(http.MethodGet, "/"+id+"/access", nil)
			if token != "" {
				req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: token})
			}
			w := httptest.NewRecorder()
			accessHandler.ServeHTTP(w, req)
			var result struct {
				Allowed bool   `json:"allowed"`
				Reason  string `json:"reason"`
			}
			if w.Code != http.StatusOK || json.Unmarshal(w.Body.Bytes(), &result) != nil || result.Allowed != want || result.Reason != reason {
				t.Fatalf("access want=%v: %d %s", want, w.Code, w.Body.String())
			}
		}
		checkAccess("", false, "package_required")
		checkAccess(studentToken, true, "user_entitlement")
		callQuiz := func(key string) *httptest.ResponseRecorder {
			body := `{"submissionKey":"` + key + `","answers":{"` + questionID + `":0}}`
			req := httptest.NewRequest(http.MethodPost, "/"+id+"/submit", strings.NewReader(body))
			req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: studentToken})
			req.Header.Set("X-CSRF-Token", studentCSRF)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			return w
		}
		key := "paid-retry-" + suffix
		first := callQuiz(key)
		if first.Code != http.StatusCreated {
			t.Fatalf("purchased submission: %d %s", first.Code, first.Body.String())
		}
		tag, err := db.Exec(ctx, `UPDATE commerce_entitlements SET status='expired' WHERE user_id=$1::uuid AND product_id=$2::uuid AND status='active'`, student, product.Product.ID)
		if err != nil || tag.RowsAffected() != 1 {
			t.Fatalf("expire test entitlement: %v rows=%d", err, tag.RowsAffected())
		}
		defer func() {
			_, _ = db.Exec(ctx, `UPDATE commerce_entitlements SET status='active' WHERE user_id=$1::uuid AND product_id=$2::uuid AND status='expired'`, student, product.Product.ID)
		}()
		checkAccess(studentToken, false, "paid_required")
		retry := callQuiz(key)
		if retry.Code != http.StatusCreated || !bytes.Equal(first.Body.Bytes(), retry.Body.Bytes()) {
			t.Fatalf("owned retry after expiry: %d %s", retry.Code, retry.Body.String())
		}
		newAttempt := callQuiz("new-after-expiry-" + suffix)
		if newAttempt.Code != http.StatusForbidden {
			t.Fatalf("new submission after expiry: %d %s", newAttempt.Code, newAttempt.Body.String())
		}
		if _, err := db.Exec(ctx, `DELETE FROM assessment_learning_placements WHERE assessment_id=$1::uuid`, id); err != nil {
			t.Fatal(err)
		}
	})
	if _, err = db.Exec(ctx, `INSERT INTO assessment_version_questions(assessment_id,assessment_version,question_id,question_version) VALUES($1,1,$2,1)`, assessID, questionID); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO assessment_learning_placements(assessment_id,assessment_version,slot,path_id,subject_id,is_visible) VALUES($1,1,'training',$2,$3,true) RETURNING id::text`, assessID, path, subject).Scan(&placementID); err != nil {
		t.Fatal(err)
	}
	var planID string
	if err = db.QueryRow(ctx, `INSERT INTO study_plans(student_id,name,path_id,start_date,end_date) VALUES($1,'test plan',$2,CURRENT_DATE,CURRENT_DATE) RETURNING id::text`, student, path).Scan(&planID); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO study_plan_items(plan_id,subject_id,item_type,assessment_placement_id,scheduled_date,scheduled_time,duration_minutes,phase,sort_order) VALUES($1,$2,'assessment',$3,CURRENT_DATE,'17:00',20,'practice',0)`, planID, subject, placementID); err != nil {
		t.Fatal(err)
	}
	assessRepo := assessmentpg.New(db, operationspg.NewAuditWriter())
	planService := learningapp.NewStudyPlanService(learningpg.New(db), taxonomypg.New(db), contentpg.New(db, operationspg.NewAuditWriter()), assessmentapp.NewStudyPlanCatalog(assessRepo, nil))
	planHandler := learninghttp.NewStudyPlans(planService, auth)
	checkPlan := func(wantAvailable bool) {
		req := httptest.NewRequest(http.MethodGet, "/"+planID, nil)
		req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: studentToken})
		result := httptest.NewRecorder()
		planHandler.ServeHTTP(result, req)
		var payload struct {
			Plan struct {
				Items []struct {
					Completed bool `json:"completed"`
					Available bool `json:"available"`
				} `json:"items"`
			} `json:"plan"`
		}
		if err := json.Unmarshal(result.Body.Bytes(), &payload); err != nil || result.Code != http.StatusOK || len(payload.Plan.Items) != 1 || !payload.Plan.Items[0].Completed || payload.Plan.Items[0].Available != wantAvailable {
			t.Fatalf("study plan completion available=%v: %d %s %v", wantAvailable, result.Code, result.Body.String(), err)
		}
	}
	directService := assessmentapp.NewAttemptService(assessRepo)
	directAttempt, err := directService.Start(ctx, studentUser, assessID, "direct-existing-"+suffix)
	if err != nil {
		t.Fatalf("direct initial attempt: %v", err)
	}
	placementHandler := assessmenthttp.NewPlacements(assessmentapp.NewPlacementService(assessRepo, nil, contentpg.New(db, operationspg.NewAuditWriter())), auth)
	placementCall := func(method, route, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, route, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: studentToken})
		req.Header.Set("X-CSRF-Token", studentCSRF)
		w := httptest.NewRecorder()
		placementHandler.ServeHTTP(w, req)
		return w
	}
	startRoute := "/" + placementID + "/start"
	listRoute := "/available?slot=training&pathId=" + path + "&subjectId=" + subject
	w = placementCall(http.MethodGet, listRoute, "")
	if w.Code != http.StatusOK || !bytes.Contains(w.Body.Bytes(), []byte(placementID)) {
		t.Fatalf("visible placement %d %s", w.Code, w.Body.String())
	}
	w = placementCall(http.MethodPost, startRoute, `{"startKey":"existing-`+suffix+`"}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("initial attempt %d %s", w.Code, w.Body.String())
	}
	var firstAttempt struct {
		Attempt struct {
			ID string `json:"id"`
		} `json:"attempt"`
	}
	if err = json.Unmarshal(w.Body.Bytes(), &firstAttempt); err != nil || firstAttempt.Attempt.ID == "" {
		t.Fatalf("initial attempt id: %s %v", w.Body.String(), err)
	}
	if _, err = directService.Submit(ctx, studentUser, firstAttempt.Attempt.ID, "submission-"+suffix); err != nil {
		t.Fatalf("complete assessment: %v", err)
	}
	setVisibility("subjects/"+subject, false)
	hiddenSubjectRows, err := assessRepo.ListStudyPlanResources(ctx, student, path, []string{subject}, nil, 50)
	if err != nil || len(hiddenSubjectRows) != 0 {
		t.Fatalf("hidden subject assessment study plan: %+v %v", hiddenSubjectRows, err)
	}
	setVisibility("subjects/"+subject, true)
	setVisibility("paths/"+path, false)
	checkPlan(false)
	completed, err := assessRepo.CompletedStudyPlanAssessments(ctx, student, []string{placementID})
	if err != nil || !completed[placementID] {
		t.Fatalf("hidden scope lost assessment completion: %+v %v", completed, err)
	}
	otherCompletion, err := assessRepo.CompletedStudyPlanAssessments(ctx, adminUser.ID, []string{placementID})
	if err != nil || otherCompletion[placementID] {
		t.Fatalf("completion leaked to another user: %+v %v", otherCompletion, err)
	}
	var savedItems int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM study_plan_items WHERE plan_id=$1`, planID).Scan(&savedItems); err != nil || savedItems != 1 {
		t.Fatalf("hidden scope erased study plan items: %d %v", savedItems, err)
	}
	planRows, err := assessRepo.ListStudyPlanResources(ctx, student, path, []string{subject}, nil, 50)
	if err != nil || len(planRows) != 0 {
		t.Fatalf("hidden assessment study plan resources: %+v %v", planRows, err)
	}
	if _, err = assessRepo.GetPublishedAccessContext(ctx, assessID); err == nil {
		t.Fatal("hidden path allows direct assessment start")
	}
	if _, err = directService.Start(ctx, studentUser, assessID, "direct-new-"+suffix); err == nil {
		t.Fatal("hidden path allowed direct new attempt")
	}
	if again, err := directService.Start(ctx, studentUser, assessID, "direct-existing-"+suffix); err != nil || again.ID != directAttempt.ID {
		t.Fatalf("hidden direct existing attempt: %+v %v", again, err)
	}
	w = placementCall(http.MethodGet, listRoute, "")
	if w.Code != http.StatusNotFound {
		t.Fatalf("hidden placement list %d %s", w.Code, w.Body.String())
	}
	w = placementCall(http.MethodPost, startRoute, `{"startKey":"new-`+suffix+`"}`)
	if w.Code != http.StatusNotFound {
		t.Fatalf("hidden new attempt %d %s", w.Code, w.Body.String())
	}
	w = placementCall(http.MethodPost, startRoute, `{"startKey":"existing-`+suffix+`"}`)
	if w.Code != http.StatusCreated || !bytes.Contains(w.Body.Bytes(), []byte(firstAttempt.Attempt.ID)) {
		t.Fatalf("existing attempt hidden %d %s", w.Code, w.Body.String())
	}
	setVisibility("paths/"+path, true)
	checkPlan(true)
	planRows, err = assessRepo.ListStudyPlanResources(ctx, student, path, []string{subject}, nil, 50)
	if err != nil || len(planRows) != 1 || planRows[0].PlacementID != placementID {
		t.Fatalf("restored assessment study plan resources: %+v %v", planRows, err)
	}
	if _, err = assessRepo.GetPublishedAccessContext(ctx, assessID); err != nil {
		t.Fatalf("restored direct assessment: %v", err)
	}
	if _, err = directService.Start(ctx, studentUser, assessID, "direct-new-"+suffix); err != nil {
		t.Fatalf("restored direct start: %v", err)
	}
	w = placementCall(http.MethodPost, startRoute, `{"startKey":"new-`+suffix+`"}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("restored new attempt %d %s", w.Code, w.Body.String())
	}
	var attemptCount int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM assessment_attempts WHERE placement_id=$1 AND student_id=$2`, placementID, student).Scan(&attemptCount); err != nil || attemptCount != 2 {
		t.Fatalf("attempt preservation count %d: %v", attemptCount, err)
	}
	// A school-directed live session stays separate from public path visibility,
	// but only active pupils of the selected active school and class may join.
	var schoolID, classID, sessionID string
	if err = db.QueryRow(ctx, `INSERT INTO schools(code,name) VALUES($1,'test school') RETURNING id::text`, "SCHOOL"+suffix).Scan(&schoolID); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO classes(school_id,code,name) VALUES($1,'CLASS','test class') RETURNING id::text`, schoolID).Scan(&classID); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO school_memberships(school_id,user_id,role) VALUES($1,$2,'student')`, schoolID, student); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO class_memberships(class_id,user_id) VALUES($1,$2)`, classID, student); err != nil {
		t.Fatal(err)
	}
	staffStudent, err := identityRepo.CreateUser(ctx, "wrong membership", "wrongmembership"+suffix+"@example.invalid", hash, identity.RoleStudent)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO school_memberships(school_id,user_id,role) VALUES($1,$2,'teacher')`, schoolID, staffStudent.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO class_memberships(class_id,user_id) VALUES($1,$2)`, classID, staffStudent.ID); err != nil {
		t.Fatal(err)
	}
	staffToken, staffCSRF := login(staffStudent.Email)
	otherStudent, err := identityRepo.CreateUser(ctx, "other class", "otherclass"+suffix+"@example.invalid", hash, identity.RoleStudent)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO school_memberships(school_id,user_id,role) VALUES($1,$2,'student')`, schoolID, otherStudent.ID); err != nil {
		t.Fatal(err)
	}
	otherToken, otherCSRF := login(otherStudent.Email)
	sessionCode := "live" + suffix
	if err = db.QueryRow(ctx, `INSERT INTO assessment_sessions(assessment_id,assessment_version,channel,session_code,status,school_id,class_id,created_by) VALUES($1,1,'live',$2,'active',$3,$4,$5) RETURNING id::text`, assessID, sessionCode, schoolID, classID, adminUser.ID).Scan(&sessionID); err != nil {
		t.Fatal(err)
	}
	sessionHandler := assessmenthttp.NewSessions(assessmentapp.NewSessionService(assessRepo, assessmentapp.NewService(assessRepo)), auth)
	sessionCall := func(method, route, token, csrf, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, route, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: token})
		req.Header.Set("X-CSRF-Token", csrf)
		out := httptest.NewRecorder()
		sessionHandler.ServeHTTP(out, req)
		return out
	}
	if w = sessionCall(http.MethodGet, "/join/"+sessionCode, studentToken, "", ""); w.Code != http.StatusOK {
		t.Fatalf("eligible live join %d %s", w.Code, w.Body.String())
	}
	if w = sessionCall(http.MethodGet, "/join/"+sessionCode, staffToken, "", ""); w.Code != http.StatusNotFound {
		t.Fatalf("non-student school membership joined %d %s", w.Code, w.Body.String())
	}
	if w = sessionCall(http.MethodPost, "/"+sessionID+"/start", staffToken, staffCSRF, `{"startKey":"staff-`+suffix+`"}`); w.Code != http.StatusNotFound {
		t.Fatalf("non-student school membership started %d %s", w.Code, w.Body.String())
	}
	if w = sessionCall(http.MethodGet, "/join/"+sessionCode, otherToken, "", ""); w.Code != http.StatusNotFound {
		t.Fatalf("student outside class joined %d %s", w.Code, w.Body.String())
	}
	if w = sessionCall(http.MethodPost, "/"+sessionID+"/start", otherToken, otherCSRF, `{"startKey":"other-`+suffix+`"}`); w.Code != http.StatusNotFound {
		t.Fatalf("student outside class started %d %s", w.Code, w.Body.String())
	}
	setVisibility("paths/"+path, false)
	if w = sessionCall(http.MethodGet, "/join/"+sessionCode, studentToken, "", ""); w.Code != http.StatusOK {
		t.Fatalf("school-directed session hidden from eligible student: %d %s", w.Code, w.Body.String())
	}
	w = sessionCall(http.MethodPost, "/"+sessionID+"/start", studentToken, studentCSRF, `{"startKey":"live-existing-`+suffix+`"}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("eligible live start %d %s", w.Code, w.Body.String())
	}
	var liveAttempt struct {
		Attempt struct {
			ID string `json:"id"`
		} `json:"attempt"`
	}
	if err = json.Unmarshal(w.Body.Bytes(), &liveAttempt); err != nil || liveAttempt.Attempt.ID == "" {
		t.Fatalf("live attempt response %s %v", w.Body.String(), err)
	}
	if _, err = db.Exec(ctx, `UPDATE schools SET status='suspended' WHERE id=$1`, schoolID); err != nil {
		t.Fatal(err)
	}
	if w = sessionCall(http.MethodGet, "/join/"+sessionCode, studentToken, "", ""); w.Code != http.StatusNotFound {
		t.Fatalf("suspended school live join %d %s", w.Code, w.Body.String())
	}
	if w = sessionCall(http.MethodPost, "/"+sessionID+"/start", studentToken, studentCSRF, `{"startKey":"suspended-`+suffix+`"}`); w.Code != http.StatusNotFound {
		t.Fatalf("suspended school live start %d %s", w.Code, w.Body.String())
	}
	if w = sessionCall(http.MethodPost, "/"+sessionID+"/start", studentToken, studentCSRF, `{"startKey":"live-existing-`+suffix+`"}`); w.Code != http.StatusCreated || !bytes.Contains(w.Body.Bytes(), []byte(liveAttempt.Attempt.ID)) {
		t.Fatalf("existing live attempt not preserved: %d %s", w.Code, w.Body.String())
	}
	if existing, err := directService.Get(ctx, studentUser, liveAttempt.Attempt.ID); err != nil || existing.ID != liveAttempt.Attempt.ID {
		t.Fatalf("existing attempt retrieval during school suspension: %+v %v", existing, err)
	}
	if _, err := directService.Get(ctx, otherStudent, liveAttempt.Attempt.ID); err == nil {
		t.Fatal("other student accessed a live attempt")
	}
	if _, err = db.Exec(ctx, `UPDATE schools SET status='active' WHERE id=$1`, schoolID); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `UPDATE classes SET status='archived' WHERE id=$1`, classID); err != nil {
		t.Fatal(err)
	}
	if w = sessionCall(http.MethodGet, "/join/"+sessionCode, studentToken, "", ""); w.Code != http.StatusNotFound {
		t.Fatalf("archived class live join %d %s", w.Code, w.Body.String())
	}
	if w = sessionCall(http.MethodPost, "/"+sessionID+"/start", studentToken, studentCSRF, `{"startKey":"class-archived-`+suffix+`"}`); w.Code != http.StatusNotFound {
		t.Fatalf("archived class live start %d %s", w.Code, w.Body.String())
	}
	if _, err = db.Exec(ctx, `UPDATE classes SET status='active' WHERE id=$1`, classID); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `UPDATE school_memberships SET status='suspended' WHERE school_id=$1 AND user_id=$2 AND role='student'`, schoolID, student); err != nil {
		t.Fatal(err)
	}
	if w = sessionCall(http.MethodGet, "/join/"+sessionCode, studentToken, "", ""); w.Code != http.StatusNotFound {
		t.Fatalf("suspended student joined %d %s", w.Code, w.Body.String())
	}
	if w = sessionCall(http.MethodPost, "/"+sessionID+"/start", studentToken, studentCSRF, `{"startKey":"pupil-suspended-`+suffix+`"}`); w.Code != http.StatusNotFound {
		t.Fatalf("suspended student started %d %s", w.Code, w.Body.String())
	}
	if w = sessionCall(http.MethodPost, "/"+sessionID+"/start", studentToken, studentCSRF, `{"startKey":"live-existing-`+suffix+`"}`); w.Code != http.StatusCreated || !bytes.Contains(w.Body.Bytes(), []byte(liveAttempt.Attempt.ID)) {
		t.Fatalf("suspended membership lost existing attempt: %d %s", w.Code, w.Body.String())
	}
	attemptHandler := assessmenthttp.NewAttempts(directService, auth)
	attemptCall := func(method, route, token, csrf, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, route, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: token})
		req.Header.Set("X-CSRF-Token", csrf)
		out := httptest.NewRecorder()
		attemptHandler.ServeHTTP(out, req)
		return out
	}
	answerRoute := "/" + liveAttempt.Attempt.ID + "/answers/" + questionID
	answerBody := `{"selectedOptionIndex":0,"timeSpentSeconds":10}`
	if w = attemptCall(http.MethodPut, answerRoute, otherToken, otherCSRF, answerBody); w.Code != http.StatusNotFound {
		t.Fatalf("other pupil saved answer: %d %s", w.Code, w.Body.String())
	}
	if w = attemptCall(http.MethodPut, answerRoute, studentToken, "invalid", answerBody); w.Code != http.StatusForbidden {
		t.Fatalf("invalid CSRF saved answer: %d %s", w.Code, w.Body.String())
	}
	if w = attemptCall(http.MethodPut, answerRoute, studentToken, studentCSRF, answerBody); w.Code != http.StatusOK {
		t.Fatalf("existing pupil could not save answer: %d %s", w.Code, w.Body.String())
	}
	submitRoute := "/" + liveAttempt.Attempt.ID + "/submit"
	submitBody := `{"submissionKey":"live-submit-` + suffix + `"}`
	if w = attemptCall(http.MethodPost, submitRoute, otherToken, otherCSRF, submitBody); w.Code != http.StatusNotFound {
		t.Fatalf("other pupil submitted attempt: %d %s", w.Code, w.Body.String())
	}
	if w = attemptCall(http.MethodPost, submitRoute, studentToken, studentCSRF, submitBody); w.Code != http.StatusOK {
		t.Fatalf("existing pupil could not submit: %d %s", w.Code, w.Body.String())
	}
	resultRoute := "/" + liveAttempt.Attempt.ID + "/result"
	if w = attemptCall(http.MethodGet, resultRoute, studentToken, "", ""); w.Code != http.StatusOK || !bytes.Contains(w.Body.Bytes(), []byte(`"score":100`)) {
		t.Fatalf("saved answer result: %d %s", w.Code, w.Body.String())
	}
	if w = attemptCall(http.MethodGet, resultRoute, otherToken, "", ""); w.Code != http.StatusForbidden {
		t.Fatalf("other pupil accessed result: %d %s", w.Code, w.Body.String())
	}
	if _, err = db.Exec(ctx, `UPDATE school_memberships SET status='active' WHERE school_id=$1 AND user_id=$2 AND role='student'`, schoolID, student); err != nil {
		t.Fatal(err)
	}
	if w = sessionCall(http.MethodGet, "/join/"+sessionCode, studentToken, "", ""); w.Code != http.StatusOK {
		t.Fatalf("restored pupil join %d %s", w.Code, w.Body.String())
	}
	var otherSchool, foreignClass string
	if err = db.QueryRow(ctx, `INSERT INTO schools(code,name) VALUES($1,'other school') RETURNING id::text`, "OTHER"+suffix).Scan(&otherSchool); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO classes(school_id,code,name) VALUES($1,'OTHERCLASS','other class') RETURNING id::text`, otherSchool).Scan(&foreignClass); err != nil {
		t.Fatal(err)
	}
	createSession := func(token, csrf, school, class string) *httptest.ResponseRecorder {
		payload, _ := json.Marshal(map[string]string{"assessmentId": assessID, "channel": "live", "schoolId": school, "classId": class})
		return sessionCall(http.MethodPost, "/", token, csrf, string(payload))
	}
	if w = createSession(adminToken, adminCSRF, schoolID, classID); w.Code != http.StatusCreated {
		t.Fatalf("valid session creation %d %s", w.Code, w.Body.String())
	}
	if w = createSession(adminToken, adminCSRF, schoolID, foreignClass); w.Code != http.StatusConflict {
		t.Fatalf("cross-school session creation %d %s", w.Code, w.Body.String())
	}
	if w = createSession(studentToken, studentCSRF, schoolID, classID); w.Code != http.StatusForbidden {
		t.Fatalf("student session creation %d %s", w.Code, w.Body.String())
	}
	if w = createSession(adminToken, "invalid", schoolID, classID); w.Code != http.StatusForbidden {
		t.Fatalf("invalid CSRF session creation %d %s", w.Code, w.Body.String())
	}
	if w = createSession(adminToken, adminCSRF, "", classID); w.Code != http.StatusBadRequest {
		t.Fatalf("class without school session creation %d %s", w.Code, w.Body.String())
	}
	if _, err = db.Exec(ctx, `INSERT INTO school_memberships(school_id,user_id,role) VALUES($1,$2,'student')`, otherSchool, student); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO class_memberships(class_id,user_id) VALUES($1,$2)`, foreignClass, student); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `UPDATE assessment_sessions SET class_id=$2 WHERE id=$1`, sessionID, foreignClass); err != nil {
		t.Fatal(err)
	}
	if w = sessionCall(http.MethodGet, "/join/"+sessionCode, studentToken, "", ""); w.Code != http.StatusNotFound {
		t.Fatalf("cross-school session joined %d %s", w.Code, w.Body.String())
	}
	if w = sessionCall(http.MethodPost, "/"+sessionID+"/start", studentToken, studentCSRF, `{"startKey":"cross-school-`+suffix+`"}`); w.Code != http.StatusNotFound {
		t.Fatalf("cross-school session started %d %s", w.Code, w.Body.String())
	}
	if _, err = db.Exec(ctx, `UPDATE assessment_sessions SET class_id=$2 WHERE id=$1`, sessionID, classID); err != nil {
		t.Fatal(err)
	}
	setVisibility("paths/"+path, true)
	// Approved assessment visibility changes independently of publication and
	// version history; existing attempts stay recoverable while hidden.
	definitionHandler := assessmenthttp.New(assessmentapp.NewService(assessRepo), auth)
	visibilityCall := func(token, csrf, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/"+assessID+"/visibility", strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: identitysession.CookieName, Value: token})
		req.Header.Set("X-CSRF-Token", csrf)
		out := httptest.NewRecorder()
		definitionHandler.ServeHTTP(out, req)
		return out
	}
	var revision, currentVersion, publishedVersion int
	if err = db.QueryRow(ctx, `SELECT revision,current_version,published_version FROM assessments WHERE id=$1`, assessID).Scan(&revision, &currentVersion, &publishedVersion); err != nil {
		t.Fatal(err)
	}
	hideBody := fmt.Sprintf(`{"expectedRevision":%d,"isVisible":false}`, revision)
	if result := visibilityCall(studentToken, studentCSRF, hideBody); result.Code != http.StatusForbidden {
		t.Fatalf("student changed visibility: %d %s", result.Code, result.Body.String())
	}
	if result := visibilityCall(adminToken, "invalid", hideBody); result.Code != http.StatusForbidden {
		t.Fatalf("invalid csrf changed visibility: %d %s", result.Code, result.Body.String())
	}
	if result := visibilityCall(adminToken, adminCSRF, hideBody); result.Code != http.StatusOK {
		t.Fatalf("admin hide: %d %s", result.Code, result.Body.String())
	}
	var visible, published bool
	var afterRevision, afterCurrent, afterPublished int
	if err = db.QueryRow(ctx, `SELECT is_visible,is_published,revision,current_version,published_version FROM assessments WHERE id=$1`, assessID).Scan(&visible, &published, &afterRevision, &afterCurrent, &afterPublished); err != nil {
		t.Fatal(err)
	}
	if visible || !published || afterRevision != revision+1 || afterCurrent != currentVersion || afterPublished != publishedVersion {
		t.Fatalf("visibility changed publication or version: visible=%v published=%v revision=%d current=%d publishedVersion=%d", visible, published, afterRevision, afterCurrent, afterPublished)
	}
	if _, err = assessRepo.GetPublishedAccessContext(ctx, assessID); err == nil {
		t.Fatal("hidden assessment allowed a new direct access")
	}
	if again, err := directService.Start(ctx, studentUser, assessID, "direct-existing-"+suffix); err != nil || again.ID != directAttempt.ID {
		t.Fatalf("hidden assessment lost existing attempt: %+v %v", again, err)
	}
	if result := visibilityCall(adminToken, adminCSRF, fmt.Sprintf(`{"expectedRevision":%d,"isVisible":true}`, revision)); result.Code != http.StatusConflict {
		t.Fatalf("stale visibility update: %d %s", result.Code, result.Body.String())
	}
	if result := visibilityCall(adminToken, adminCSRF, fmt.Sprintf(`{"expectedRevision":%d,"isVisible":true}`, afterRevision)); result.Code != http.StatusOK {
		t.Fatalf("admin show: %d %s", result.Code, result.Body.String())
	}
	if _, err = assessRepo.GetPublishedAccessContext(ctx, assessID); err != nil {
		t.Fatalf("restored assessment not accessible: %v", err)
	}
	var visibilityAudits int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM audit_logs WHERE action='assessment.visibility' AND resource_type='assessment' AND resource_id=$1`, assessID).Scan(&visibilityAudits); err != nil || visibilityAudits != 2 {
		t.Fatalf("visibility audit count=%d error=%v", visibilityAudits, err)
	}
	if os.Getenv("COMMERCE_JOURNEY_BROWSER") == "1" {
		var browserLevel string
		if err = db.QueryRow(ctx, `INSERT INTO levels(path_id,code,name) VALUES($1,$2,'مرحلة فحص تجريبية') RETURNING id::text`, path, "BL"+suffix).Scan(&browserLevel); err != nil {
			t.Fatal(err)
		}
		browserStudent, err := identityRepo.CreateUser(ctx, "browser student", "browser"+suffix+"@example.invalid", hash, identity.RoleStudent)
		if err != nil {
			t.Fatal(err)
		}
		var topicID, lessonID string
		if err = db.QueryRow(ctx, `INSERT INTO foundation_topics(path_id,subject_id,code,title,status,is_visible,is_locked,created_by) VALUES($1,$2,$3,'موضوع تأسيس مدفوع','active',true,true,$4) RETURNING id::text`, path, subject, "topic"+suffix, adminUser.ID).Scan(&topicID); err != nil {
			t.Fatal(err)
		}
		if err = db.QueryRow(ctx, `INSERT INTO lessons(path_id,subject_id,title,description,lesson_type,content_text,workflow_status,is_visible,is_locked,owner_type,created_by,approved_by,approved_at) VALUES($1,$2,'درس باقة تجريبي','','text','محتوى محمي تجريبي','approved',true,false,'platform',$3,$3,now()) RETURNING id::text`, path, subject, adminUser.ID).Scan(&lessonID); err != nil {
			t.Fatal(err)
		}
		if _, err = db.Exec(ctx, `INSERT INTO topic_lessons(topic_id,lesson_id,sort_order) VALUES($1,$2,0)`, topicID, lessonID); err != nil {
			t.Fatal(err)
		}
		router := chi.NewRouter()
		router.Mount("/api/v1/auth", identityhttp.New(auth, false))
		router.Mount("/api/v1/taxonomy", taxonomyhttp.New(taxonomyapp.NewService(taxonomypg.New(db)), auth))
		router.Mount("/api/v1/learning/navigation-preferences", navigation.NewHandler(navigation.NewService(navigation.NewPostgres(db)), auth))
		router.Mount("/api/v1/commerce", h)
		contentRepo := contentpg.New(db, operationspg.NewAuditWriter())
		contentService := contentapp.NewServiceWithAuthorScope(contentRepo, contentRepo, service)
		router.Mount("/api/v1/learning-spaces", contenthttp.NewLearningSpaces(contentService, auth))
		server := httptest.NewServer(router)
		defer server.Close()
		web, err := filepath.Abs("../../../../apps/web")
		if err != nil {
			t.Fatal(err)
		}
		command := exec.CommandContext(ctx, "node", "node_modules/@playwright/test/cli.js", "test", "tests/e2e/package-live-journey.spec.ts", "--project=chromium", "--workers=1")
		command.Dir = web
		command.Env = append(os.Environ(), "CI=1", "PACKAGE_LIVE=1", "E2E_API_TARGET="+server.URL, "PACKAGE_STUDENT_EMAIL="+browserStudent.Email, "PACKAGE_ADMIN_EMAIL="+adminUser.Email, "PACKAGE_PASSWORD="+password, "PACKAGE_PATH_ID="+path, "PACKAGE_SUBJECT_ID="+subject, "PACKAGE_LEVEL_ID="+browserLevel, "PACKAGE_TOPIC_ID="+topicID, "PACKAGE_LESSON_ID="+lessonID, "PACKAGE_PRODUCT_ID="+product.Product.ID)
		output, err := command.CombinedOutput()
		t.Log(string(output))
		if err != nil {
			t.Fatalf("isolated browser journey: %v", err)
		}
	}
}
