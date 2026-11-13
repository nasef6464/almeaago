package postgres

import (
	"context"
	"fmt"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	assessmentapp "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	assessmenthttp "github.com/nasef6464/almeaago/internal/assessment/transport/http"
	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	contentpg "github.com/nasef6464/almeaago/internal/content/repository/postgres"
	contenthttp "github.com/nasef6464/almeaago/internal/content/transport/http"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	identitypg "github.com/nasef6464/almeaago/internal/identity/repository/postgres"
	identityhttp "github.com/nasef6464/almeaago/internal/identity/transport/http"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	"github.com/nasef6464/almeaago/internal/learning/navigation"
	learningpg "github.com/nasef6464/almeaago/internal/learning/repository/postgres"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	"github.com/nasef6464/almeaago/internal/platform/security"
	questionapp "github.com/nasef6464/almeaago/internal/questionbank/application"
	questionpg "github.com/nasef6464/almeaago/internal/questionbank/repository/postgres"
	questionhttp "github.com/nasef6464/almeaago/internal/questionbank/transport/http"
	reportingpg "github.com/nasef6464/almeaago/internal/reporting/repository/postgres"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomypg "github.com/nasef6464/almeaago/internal/taxonomy/repository/postgres"
	taxonomyhttp "github.com/nasef6464/almeaago/internal/taxonomy/transport/http"
)

func TestPreparedQuizLiveBrowser(t *testing.T) {
	if os.Getenv("PREPARED_QUIZ_LIVE_BROWSER") != "1" {
		t.Skip("opt-in browser and disposable local database required")
	}
	dsn := os.Getenv("ASSESSMENT_SELF_SCHEMA_TEST_DATABASE_URL")
	if dsn == "" {
		t.Fatal("disposable local PostgreSQL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("prepared_browser_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+quoted); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cleanupCancel()
		if _, cleanupErr := admin.Exec(cleanupCtx, "DROP SCHEMA "+quoted+" CASCADE"); cleanupErr != nil {
			t.Logf("isolated schema cleanup failed: %v", cleanupErr)
		}
	}()
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	cfg.MaxConns = 6
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer closePreparedBrowserResource(db.Close)
	files, err := filepath.Glob("../../../../migrations/*.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(files)
	for _, file := range files {
		if strings.Compare(filepath.Base(file), "000061_") >= 0 {
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
	identityRepo := identitypg.New(db)
	password := "Prepared-local-browser-45!"
	hash, err := security.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	var adminUser identity.User
	for _, u := range []struct {
		name, email string
		role        identity.Role
	}{
		{"مسؤول الاختبار", "prepared-admin@example.invalid", identity.RoleAdmin},
		{"طالب الاختبار", "prepared-owner@example.invalid", identity.RoleStudent},
		{"طالب آخر", "prepared-other@example.invalid", identity.RoleStudent},
	} {
		created, createErr := identityRepo.CreateUser(ctx, u.name, u.email, hash, u.role)
		if createErr != nil {
			t.Fatal(createErr)
		}
		if u.role == identity.RoleAdmin {
			adminUser = created
		}
	}
	_, err = db.Exec(ctx, `
INSERT INTO paths(id,code,name) VALUES ('00000000-0000-0000-0000-000000000003','LIVE-P','مسار تجريبي');
INSERT INTO subjects(id,path_id,code,name) VALUES ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','LIVE-S','مادة تجريبية');
INSERT INTO questions(id,question_code,path_id,subject_id,workflow_status) VALUES ('00000000-0000-0000-0000-000000000005','LIVE-Q','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','approved');
INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index) VALUES ('00000000-0000-0000-0000-000000000005',1,'mcq','سؤال تجريبي',0);
INSERT INTO question_options(question_id,version,option_index,option_text) VALUES ('00000000-0000-0000-0000-000000000005',1,0,'نعم'),('00000000-0000-0000-0000-000000000005',1,1,'لا');`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, `
INSERT INTO skills(id,subject_id,code,name,kind) VALUES ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000004','LIVE-MAIN','المهارة الرئيسية','main');
INSERT INTO skills(id,subject_id,parent_skill_id,code,name,kind) VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000020','LIVE-SUB','مهارة فرعية تجريبية','sub');
INSERT INTO question_skill_links(question_id,skill_id,relation_type) VALUES ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000021','sub');
INSERT INTO foundation_topics(id,subject_id,path_id,code,title) VALUES ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','LIVE-PARENT','موضوع رئيسي تجريبي');
INSERT INTO foundation_topics(id,subject_id,path_id,parent_topic_id,code,title) VALUES ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000023','LIVE-TOPIC','موضوع تأسيس تجريبي');
INSERT INTO topic_skill_links(topic_id,skill_id,relation_type) VALUES ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000021','primary');
INSERT INTO lessons(id,path_id,subject_id,title,lesson_type,video_url,video_source,workflow_status) VALUES
 ('00000000-0000-0000-0000-000000000024','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','مقطع شرح تجريبي أول','video','https://www.youtube.com/watch?v=dQw4w9WgXcQ','youtube','approved'),
 ('00000000-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','مقطع شرح تجريبي ثان','video','https://www.youtube.com/watch?v=dQw4w9WgXcQ','youtube','approved');
INSERT INTO topic_lessons(topic_id,lesson_id,sort_order) VALUES ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000024',1),('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000025',2);`)
	if err != nil {
		t.Fatal(err)
	}
	if os.Getenv("PREPARED_IMAGE_QUIZ") == "1" {
		_, err = db.Exec(ctx, `
INSERT INTO assets(id,object_key,public_url,mime_type,size_bytes) VALUES ('00000000-0000-0000-0000-000000000027','test/question.svg','data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect width="80" height="80" fill="white"/%3E%3C/svg%3E','image/svg+xml',80);
UPDATE question_versions SET image_asset_id='00000000-0000-0000-0000-000000000027',image_alt='صورة السؤال الكاملة',text_content='نص خاص بسياق الذكاء',source_meta='{"passage":"قطعة خاصة بسياق الذكاء","learnerPresentation":{"optionLabelStyle":"latin","showOptionText":true,"showOptionLabels":false}}'::jsonb WHERE question_id='00000000-0000-0000-0000-000000000005' AND version=1;
INSERT INTO question_options(question_id,version,option_index,option_text) VALUES ('00000000-0000-0000-0000-000000000005',1,2,'إجابة ثالثة'),('00000000-0000-0000-0000-000000000005',1,3,'إجابة رابعة');`)
		if err != nil {
			t.Fatalf("image question fixture: %v", err)
		}
		if os.Getenv("PREPARED_IMAGE_ARABIC") == "1" {
			_, err = db.Exec(ctx, `UPDATE question_versions SET source_meta=jsonb_set(source_meta,'{learnerPresentation,optionLabelStyle}', '"arabic"'::jsonb) WHERE question_id='00000000-0000-0000-0000-000000000005' AND version=1`)
			if err != nil {
				t.Fatal(err)
			}
		}
	}
	auth := identityapp.NewService(identityRepo)
	adminService := identityapp.NewAdminService(identityRepo, reportingpg.NewAdminUserDirectory(db))
	repo := New(db, operationspg.NewAuditWriter())
	defs := assessmentapp.NewService(repo)
	created, err := defs.Create(ctx, adminUser, assessment.Write{
		Code: "LIVE-PREPARED", OwnerType: assessment.OwnerPlatform, IsVisible: true,
		Version:   assessment.Version{Title: "اختبار تجريبي جاهز", PathID: "00000000-0000-0000-0000-000000000003", SubjectID: "00000000-0000-0000-0000-000000000004", Kind: assessment.KindNormal, NormalMode: assessment.ModeExam, OptionLayout: "auto", ShowResultsReport: true, ShowAnswers: true, AllowQuestionReview: true, MaxAttempts: 10, PassingScore: 60, Presentation: []byte(`{}`)},
		Questions: []assessment.QuestionPlacement{{QuestionID: "00000000-0000-0000-0000-000000000005", QuestionVersion: 1, Points: 1}},
	})
	if err != nil {
		t.Fatalf("create assessment: %v", err)
	}
	for _, status := range []assessment.WorkflowStatus{assessment.WorkflowPendingReview, assessment.WorkflowApproved} {
		created, err = defs.SetWorkflow(ctx, adminUser, created.ID, created.Revision, status, "")
		if err != nil {
			t.Fatalf("workflow %s: %v", status, err)
		}
	}
	created, err = defs.SetPublication(ctx, adminUser, created.ID, created.Revision, true)
	if err != nil {
		t.Fatalf("publish assessment: %v", err)
	}
	if os.Getenv("PREPARED_IMAGE_QUIZ") == "1" {
		if _, err = db.Exec(ctx, `UPDATE assessment_versions SET randomize_options=true WHERE assessment_id=$1::uuid AND version=1`, created.ID); err != nil {
			t.Fatal(err)
		}
	}
	_, err = db.Exec(ctx, `
INSERT INTO assessments(id,assessment_code) VALUES ('00000000-0000-0000-0000-000000000026','LIVE-TOPIC-PRACTICE');
INSERT INTO assessment_versions(assessment_id,version,title,path_id,subject_id,assessment_kind,normal_mode,version_status,published_at,max_attempts) VALUES ('00000000-0000-0000-0000-000000000026',1,'تدريب الموضوع التجريبي','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','normal','practice','published',now(),10);
UPDATE assessments SET workflow_status='approved',is_published=true,published_version=1 WHERE id='00000000-0000-0000-0000-000000000026';
INSERT INTO assessment_version_questions(assessment_id,assessment_version,question_id,question_version) VALUES ('00000000-0000-0000-0000-000000000026',1,'00000000-0000-0000-0000-000000000005',1);
INSERT INTO assessment_learning_placements(assessment_id,assessment_version,slot,path_id,subject_id,topic_id,is_visible) VALUES('00000000-0000-0000-0000-000000000026',1,'foundation','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000022',true)`)
	if err != nil {
		t.Fatalf("create topic training: %v", err)
	}
	_, err = db.Exec(ctx, `
INSERT INTO subjects(id,path_id,code,name) VALUES ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000003','LIVE-S2','المادة الثانية');
INSERT INTO questions(id,question_code,path_id,subject_id,workflow_status) VALUES ('00000000-0000-0000-0000-000000000008','LIVE-Q2','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000007','approved');
INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index) VALUES ('00000000-0000-0000-0000-000000000008',1,'mcq','سؤال القسم الثاني',0);
INSERT INTO question_options(question_id,version,option_index,option_text) VALUES ('00000000-0000-0000-0000-000000000008',1,0,'صحيح'),('00000000-0000-0000-0000-000000000008',1,1,'خطأ');`)
	if err != nil {
		t.Fatal(err)
	}
	strict := true
	mode := "qiyas_strict"
	if os.Getenv("PREPARED_MOCK_FLEXIBLE") == "1" {
		strict = false
		mode = "flexible"
	}
	target := 80.0
	var firstSectionLimit *int
	if os.Getenv("PREPARED_MOCK_TIMED") == "1" {
		seconds := 8
		firstSectionLimit = &seconds
	}
	mock, err := defs.Create(ctx, adminUser, assessment.Write{
		Code: "LIVE-MOCK", OwnerType: assessment.OwnerPlatform, IsVisible: true,
		Version:   assessment.Version{Title: "محاكي قسمين", PathID: "00000000-0000-0000-0000-000000000003", Kind: assessment.KindMock, OptionLayout: "auto", MockCategory: "qudrat", MockTargetScore: &target, MockPresentationMode: mode, MockStrictSectionLock: &strict, ShowResultsReport: true, ShowAnswers: true, AllowQuestionReview: true, MaxAttempts: 5, Presentation: []byte(`{}`)},
		Sections:  []assessment.Section{{ID: "00000000-0000-0000-0000-000000000010", Title: "القسم الأول", SubjectID: "00000000-0000-0000-0000-000000000004", SortOrder: 1, TimeLimitSeconds: firstSectionLimit, Domain: "quantitative", StrictLock: strict}, {ID: "00000000-0000-0000-0000-000000000011", Title: "القسم الثاني", SubjectID: "00000000-0000-0000-0000-000000000007", SortOrder: 2, Domain: "verbal", StrictLock: strict}},
		Questions: []assessment.QuestionPlacement{{QuestionID: "00000000-0000-0000-0000-000000000005", QuestionVersion: 1, SectionID: "00000000-0000-0000-0000-000000000010", SortOrder: 1, Points: 1}, {QuestionID: "00000000-0000-0000-0000-000000000008", QuestionVersion: 1, SectionID: "00000000-0000-0000-0000-000000000011", SortOrder: 2, Points: 1}},
	})
	if err != nil {
		t.Fatalf("create strict mock: %v", err)
	}
	for _, status := range []assessment.WorkflowStatus{assessment.WorkflowPendingReview, assessment.WorkflowApproved} {
		mock, err = defs.SetWorkflow(ctx, adminUser, mock.ID, mock.Revision, status, "")
		if err != nil {
			t.Fatalf("mock workflow %s: %v", status, err)
		}
	}
	mock, err = defs.SetPublication(ctx, adminUser, mock.ID, mock.Revision, true)
	if err != nil {
		t.Fatalf("publish mock: %v", err)
	}
	attempts := assessmentapp.NewAttemptServiceWithLearning(repo, learningapp.NewService(learningpg.New(db), nil))
	sessions := assessmentapp.NewSessionService(repo, defs)
	var publicCode string
	if os.Getenv("PREPARED_IMAGE_QUIZ") == "1" {
		session, sessionErr := sessions.Create(ctx, adminUser, assessment.SessionWrite{AssessmentID: created.ID, Channel: assessment.SessionBarcode})
		if sessionErr != nil {
			t.Fatalf("create public session: %v", sessionErr)
		}
		session, sessionErr = sessions.Status(ctx, adminUser, session.ID, assessment.SessionActive)
		if sessionErr != nil {
			t.Fatalf("activate public session: %v", sessionErr)
		}
		publicCode = session.SessionCode
	}
	router := chi.NewRouter()
	router.Mount("/api/v1/auth", identityhttp.New(auth, false, identityhttp.Options{Admin: adminService}))
	router.Mount("/api/v1/assessments", assessmenthttp.New(defs, auth, attempts))
	router.Mount("/api/v1/assessment-attempts", assessmenthttp.NewAttempts(attempts, auth, assessmentapp.NewSelfQuizService(repo)))
	router.Mount("/api/v1/questions", questionhttp.New(questionapp.NewService(questionpg.New(db, operationspg.NewAuditWriter())), auth))
	router.Mount("/api/v1/public-assessments", assessmenthttp.NewPublicSessions(sessions))
	router.Mount("/api/v1/taxonomy", taxonomyhttp.New(taxonomyapp.NewService(taxonomypg.New(db)), auth))
	contentRepo := contentpg.New(db, operationspg.NewAuditWriter())
	router.Mount("/api/v1/learning-spaces", contenthttp.NewLearningSpaces(contentapp.NewService(contentRepo), auth))
	router.Mount("/api/v1/learning/navigation-preferences", navigation.NewHandler(navigation.NewService(navigation.NewPostgres(db)), auth))
	router.Mount("/api/v1/assessment-placements", assessmenthttp.NewPlacements(assessmentapp.NewPlacementService(repo, defs, contentRepo), auth))
	server := httptest.NewServer(router)
	defer func() {
		server.CloseClientConnections()
		closePreparedBrowserResource(server.Close)
	}()
	webDir, err := filepath.Abs("../../../../apps/web")
	if err != nil {
		t.Fatal(err)
	}
	args := []string{"node_modules/@playwright/test/cli.js", "test", "prepared-quiz-live.spec.ts", "--config=tests/e2e/prepared-quiz-live.config.ts", "--project=chromium", "--workers=1"}
	if filter := os.Getenv("PREPARED_QUIZ_TEST_FILTER"); filter != "" {
		args = append(args, "--grep", filter)
	}
	command := exec.CommandContext(ctx, "node", args...)
	command.Dir = webDir
	webPort := os.Getenv("PREPARED_QUIZ_E2E_PORT")
	if webPort == "" {
		webPort = "4268"
	}
	command.Env = append(os.Environ(), "CI=1", "PREPARED_QUIZ_LIVE=1", "E2E_WEB_PORT="+webPort, "E2E_API_TARGET="+server.URL, "PREPARED_ASSESSMENT_ID="+created.ID, "PREPARED_MOCK_ID="+mock.ID, "PREPARED_PUBLIC_CODE="+publicCode, "PREPARED_PASSWORD="+password, "PREPARED_ADMIN_EMAIL=prepared-admin@example.invalid", "PREPARED_OWNER_EMAIL=prepared-owner@example.invalid", "PREPARED_OTHER_EMAIL=prepared-other@example.invalid")
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("prepared live browser: %v\n%s", err, output)
	}
	t.Logf("prepared live browser: %s", output)
}

// Windows may retain child processes or blocked connections after a failed
// browser launch. Bound test cleanup so it cannot hang indefinitely.
func closePreparedBrowserResource(closeFn func()) {
	done := make(chan struct{})
	go func() { closeFn(); close(done) }()
	select {
	case <-done:
	case <-time.After(15 * time.Second):
	}
}
