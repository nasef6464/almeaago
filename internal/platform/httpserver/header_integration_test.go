package httpserver_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	assessmentcatalog "github.com/nasef6464/almeaago/internal/assessment/catalog"
	commerceapp "github.com/nasef6464/almeaago/internal/commerce/application"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	commercepg "github.com/nasef6464/almeaago/internal/commerce/repository/postgres"
	commercehttp "github.com/nasef6464/almeaago/internal/commerce/transport/http"
	communicationapp "github.com/nasef6464/almeaago/internal/communication/application"
	communicationpg "github.com/nasef6464/almeaago/internal/communication/repository/postgres"
	communicationhttp "github.com/nasef6464/almeaago/internal/communication/transport/http"
	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	contentpg "github.com/nasef6464/almeaago/internal/content/repository/postgres"
	contenthttp "github.com/nasef6464/almeaago/internal/content/transport/http"
	discoveryapp "github.com/nasef6464/almeaago/internal/discovery/application"
	discoveryhttp "github.com/nasef6464/almeaago/internal/discovery/transport/http"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	identitypg "github.com/nasef6464/almeaago/internal/identity/repository/postgres"
	identityhttp "github.com/nasef6464/almeaago/internal/identity/transport/http"
	navigation "github.com/nasef6464/almeaago/internal/learning/navigation"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	orgpg "github.com/nasef6464/almeaago/internal/organizations/repository/postgres"
	"github.com/nasef6464/almeaago/internal/platform/httpserver"
	"github.com/nasef6464/almeaago/internal/platform/security"
	questionpg "github.com/nasef6464/almeaago/internal/questionbank/repository/postgres"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
	taxonomypg "github.com/nasef6464/almeaago/internal/taxonomy/repository/postgres"
	taxonomyhttp "github.com/nasef6464/almeaago/internal/taxonomy/transport/http"
)

// TestOriginalHeaderHTTPPostgresBrowser integrates the actual server mounts and
// native domain handlers. Every write is scoped to a disposable unique schema.
// Browser execution is opt-in and uses the same real cookie/session/CSRF stack.
func TestOriginalHeaderHTTPPostgresBrowser(t *testing.T) {
	if os.Getenv("HEADER_TEST_DB") != "1" || os.Getenv("DATABASE_URL") == "" {
		t.Skip("HEADER_TEST_DB=1 and isolated DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Minute)
	defer cancel()
	adminDB, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(adminDB.Close)
	var extension bool
	if err = adminDB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_trgm')`).Scan(&extension); err != nil || !extension {
		t.Fatalf("isolated database must already provision pg_trgm; fixture will not change global extensions: %v", err)
	}
	schema := fmt.Sprintf("original_header_%d", time.Now().UnixNano())
	if _, err = adminDB.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 15*time.Second)
		defer done()
		if _, err := adminDB.Exec(cleanup, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Logf("isolated schema cleanup: %v", err)
		}
	})
	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	cfg.MaxConns = 10
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	files, err := filepath.Glob("../../../migrations/*.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(files)
	applied := 0
	for _, name := range files {
		if filepath.Base(name) > "000046_zzzz" {
			continue
		}
		raw, err := os.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = db.Exec(ctx, string(raw)); err != nil {
			t.Fatalf("actual migration %s: %v", filepath.Base(name), err)
		}
		applied++
	}
	if applied != 46 {
		t.Fatalf("expected actual migrations 000001..000046, applied %d", applied)
	}
	audit := operationspg.NewAuditWriter()
	ir := identitypg.New(db)
	auth := identityapp.NewService(ir)
	hash, err := security.HashPassword("Header-test-pass-42!")
	if err != nil {
		t.Fatal(err)
	}
	createUser := func(role identity.Role) identity.User {
		t.Helper()
		user, err := ir.CreateUser(ctx, "تجربة الهيدر "+string(role), string(role)+"-"+schema+"@example.test", hash, role)
		if err != nil {
			t.Fatal(err)
		}
		return user
	}
	admin, student := createUser(identity.RoleAdmin), createUser(identity.RoleStudent)
	tr := taxonomypg.New(db)
	ts := taxonomyapp.NewService(tr)
	createPath := func(code, name, parent string, order int) taxonomy.Path {
		t.Helper()
		p, err := ts.CreatePath(ctx, admin, taxonomy.PathWrite{Code: code, Name: name, ParentPathID: parent, SortOrder: order})
		if err != nil {
			t.Fatal(err)
		}
		return p
	}
	p := createPath("qudrat", "قدرات", "", 0)
	other := createPath("tahsili", "تحصيلي", "", 1)
	child := createPath("qudrat-child", "مسار فرعي", p.ID, 2)
	createLevel := func(code, name string, order int) taxonomy.Level {
		t.Helper()
		l, err := ts.CreateLevel(ctx, admin, taxonomy.LevelWrite{PathID: p.ID, Code: code, Name: name, SortOrder: order})
		if err != nil {
			t.Fatal(err)
		}
		return l
	}
	level := createLevel("middle", "المرحلة المتوسطة", 0)
	otherLevel := createLevel("secondary", "الثانوية", 1)
	createSubject := func(code, name, levelID string, order int) taxonomy.Subject {
		t.Helper()
		s, err := ts.CreateSubject(ctx, admin, taxonomy.SubjectWrite{PathID: p.ID, LevelID: levelID, Code: code, Name: name, SortOrder: order})
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	subject := createSubject("math", "رياضيات", level.ID, 0)
	_ = createSubject("science", "علوم", otherLevel.ID, 1)
	// All content states are canonical FK-backed rows; public discovery subsequently
	// proves its own native visibility/ownership/placement predicates over them.
	var courseID, articleID, topicID string
	if err = db.QueryRow(ctx, `INSERT INTO courses(path_id,subject_id,title,description,workflow_status,is_published,is_visible,owner_type,created_by,approved_by,approved_at,published_by,published_at) VALUES($1,$2,'دورة بحث الهيدر','مرجع البحث الحي','approved',true,true,'platform',$3,$3,now(),$3,now()) RETURNING id::text`, p.ID, subject.ID, admin.ID).Scan(&courseID); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO lessons(path_id,subject_id,title,description,lesson_type,content_text,workflow_status,is_visible,is_locked,owner_type,created_by,approved_by,approved_at) VALUES($1,$2,'مقال بحث الهيدر','مقدمة المقال الحي','text','محتوى بحث الهيدر','approved',true,false,'platform',$3,$3,now()) RETURNING id::text`, p.ID, subject.ID, admin.ID).Scan(&articleID); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO foundation_topics(path_id,subject_id,code,title,status,is_visible,is_locked,created_by) VALUES($1,$2,'header-topic','موضوع بحث الهيدر','active',true,false,$3) RETURNING id::text`, p.ID, subject.ID, admin.ID).Scan(&topicID); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO topic_lessons(topic_id,lesson_id,sort_order) VALUES($1,$2,0)`, topicID, articleID); err != nil {
		t.Fatal(err)
	}
	var campaignID, notificationID string
	if err = db.QueryRow(ctx, `INSERT INTO notification_campaigns(title,body,channels,recipient_count,delivery_count,created_by) VALUES('إشعار الهيدر الحي','رسالة اختبار الهيدر الحي',ARRAY['in_app'],1,1,$1) RETURNING id::text`, admin.ID).Scan(&campaignID); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `INSERT INTO notification_deliveries(campaign_id,channel,status,title,body,recipient_user_id,provider,sent_at,created_by) VALUES($1,'in_app','sent','إشعار الهيدر الحي','رسالة اختبار الهيدر الحي',$2,'internal',now(),$2) RETURNING id::text`, campaignID, admin.ID).Scan(&notificationID); err != nil {
		t.Fatal(err)
	}
	cr := contentpg.New(db, audit)
	or := orgpg.New(db, audit, ir)
	commerceRepo := commercepg.New(db, audit)
	commerceService := commerceapp.NewService(commerceRepo, cr, tr, or)
	product, err := commerceService.CreateProduct(ctx, admin, commerce.ProductWrite{Code: "HEADER-COURSE", ProductType: commerce.ProductCourse, Name: "دورة بحث الهيدر", Description: "مرجع البحث الحي", Status: commerce.ProductActive, AccessMode: commerce.AccessPaid, PriceMinor: 15000, Currency: "SAR", CourseID: courseID, IsVisible: true})
	if err != nil {
		t.Fatal(err)
	}
	contentService := contentapp.NewServiceWithAuthorScope(cr, contentapp.NewCombinedAuthorScope(cr, or), commerceService)
	checkout := commerceapp.NewCheckoutService(commerceRepo, commerce.CheckoutPolicy{GatewayMode: commerce.GatewayManualReview}, cr)
	access := commerceapp.NewAccessService(commerceRepo, commerceRepo, or)
	communicationRepo := communicationpg.New(db, audit)
	communicationService := communicationapp.NewService(communicationRepo, ir)
	router := httpserver.New("", httpserver.Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), DB: db,
		Identity: identityhttp.New(auth, false), Taxonomy: taxonomyhttp.New(ts, auth),
		Courses: contenthttp.NewCourses(contentService, auth), Lessons: contenthttp.NewLessons(contentService, auth), Foundation: contenthttp.NewFoundation(contentService, auth), Library: contenthttp.NewLibrary(contentService, auth), LearningSpaces: contenthttp.NewLearningSpaces(contentService, auth),
		ContentManagement: contenthttp.NewManagementWithPresentation(contentService, auth, contentapp.NewFontService(cr), contentapp.NewHomepageService(cr)),
		Search:            discoveryhttp.New(discoveryapp.NewService(cr, questionpg.New(db, audit))), PublicArticles: discoveryhttp.NewArticles(discoveryapp.NewArticleService(cr)),
		PublicMockExams:       assessmentcatalog.NewHandler(assessmentcatalog.NewService(assessmentcatalog.NewPostgres(db))),
		NavigationPreferences: navigation.NewHandler(navigation.NewService(navigation.NewPostgres(db)), auth),
		Notifications:         communicationhttp.New(communicationService, auth), Commerce: commercehttp.NewWithAccess(commerceService, checkout, access, auth, nil),
	})
	server := httptest.NewServer(router.Handler)
	t.Cleanup(server.Close)
	newClient := func() *http.Client {
		jar, err := cookiejar.New(nil)
		if err != nil {
			t.Fatal(err)
		}
		return &http.Client{Jar: jar}
	}
	guest, adminClient, studentClient := newClient(), newClient(), newClient()
	call := func(client *http.Client, method, path string, body any, csrf string, want int) map[string]any {
		t.Helper()
		var reader io.Reader
		if body != nil {
			raw, err := json.Marshal(body)
			if err != nil {
				t.Fatal(err)
			}
			reader = strings.NewReader(string(raw))
		}
		req, err := http.NewRequestWithContext(ctx, method, server.URL+path, reader)
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
		var out map[string]any
		if err = json.NewDecoder(res.Body).Decode(&out); err != nil {
			t.Fatalf("decode %s %s (%d): %v", method, path, res.StatusCode, err)
		}
		if res.StatusCode != want {
			t.Fatalf("%s %s wanted %d got %d: %+v", method, path, want, res.StatusCode, out)
		}
		return out
	}
	login := func(client *http.Client, user identity.User) string {
		t.Helper()
		return call(client, "POST", "/api/v1/auth/login", map[string]any{"email": user.Email, "password": "Header-test-pass-42!"}, "", 200)["csrfToken"].(string)
	}
	login(adminClient, admin)
	studentCSRF := login(studentClient, student)
	call(adminClient, "GET", "/api/v1/auth/me", nil, "", 200)
	call(guest, "PATCH", "/api/v1/learning/navigation-preferences", map[string]any{}, "", 401)
	preferenceBody := map[string]any{"enrolledPaths": []string{p.ID}, "pathStageSelections": []map[string]string{{"pathId": p.ID, "levelId": level.ID}}}
	call(studentClient, "PATCH", "/api/v1/learning/navigation-preferences", preferenceBody, "", 403)
	call(studentClient, "PATCH", "/api/v1/learning/navigation-preferences", preferenceBody, studentCSRF, 200)
	prefs := call(studentClient, "GET", "/api/v1/learning/navigation-preferences", nil, "", 200)["user"].(map[string]any)
	if len(prefs["enrolledPaths"].([]any)) != 1 {
		t.Fatal("native preferences did not persist")
	}
	otherPrefs := call(adminClient, "GET", "/api/v1/learning/navigation-preferences", nil, "", 200)["user"].(map[string]any)
	if len(otherPrefs["enrolledPaths"].([]any)) != 0 {
		t.Fatal("native preference actor isolation failed")
	}
	// Restore empty selection for the real browser enrollment journey.
	call(studentClient, "PATCH", "/api/v1/learning/navigation-preferences", map[string]any{"enrolledPaths": []string{}}, studentCSRF, 200)
	call(studentClient, "PATCH", "/api/v1/content/homepage-settings", map[string]any{}, studentCSRF, 403)
	call(adminClient, "PATCH", "/api/v1/content/homepage-settings", map[string]any{}, "", 403)
	call(adminClient, "PATCH", "/api/v1/notifications/"+notificationID+"/read", map[string]any{}, "", 403)
	unread := call(adminClient, "GET", "/api/v1/notifications/me/unread-count", nil, "", 200)
	if unread["unreadCount"] != float64(1) {
		t.Fatalf("native notification missing: %+v", unread)
	}
	// Exercise display false and inactive path filtering through real persistence.
	no := false
	if _, err = ts.UpdatePath(ctx, admin, other.ID, taxonomy.PathPatch{ShowInNavbar: &no}); err != nil {
		t.Fatal(err)
	}
	bootstrap := call(guest, "GET", "/api/v1/taxonomy/bootstrap?phase=core", nil, "", 200)
	foundFalse := false
	for _, raw := range bootstrap["paths"].([]any) {
		row := raw.(map[string]any)
		if row["id"] == other.ID {
			foundFalse = row["showInNavbar"] == false
		}
	}
	if !foundFalse {
		t.Fatal("native taxonomy false did not roundtrip")
	}
	inactive := taxonomy.StatusInactive
	if _, err = ts.UpdatePath(ctx, admin, other.ID, taxonomy.PathPatch{Status: &inactive}); err != nil {
		t.Fatal(err)
	}
	bootstrap = call(guest, "GET", "/api/v1/taxonomy/bootstrap?phase=core", nil, "", 200)
	for _, raw := range bootstrap["paths"].([]any) {
		if raw.(map[string]any)["id"] == other.ID {
			t.Fatal("guest received inactive path")
		}
	}
	yes := true
	active := taxonomy.StatusActive
	if _, err = ts.UpdatePath(ctx, admin, other.ID, taxonomy.PathPatch{Status: &active, ShowInNavbar: &yes}); err != nil {
		t.Fatal(err)
	}
	search := call(guest, "GET", "/api/v1/search/?q="+url.QueryEscape("بحث الهيدر")+"&type=all&limit=20", nil, "", 200)
	results := search["results"].(map[string]any)
	if rows := results["courses"].([]any); len(rows) != 1 || rows[0].(map[string]any)["id"] != courseID {
		t.Fatalf("native discovery course fixture unavailable: %+v", results)
	}
	if rows := results["lessons"].([]any); len(rows) != 1 || rows[0].(map[string]any)["id"] != articleID {
		t.Fatalf("native discovery article fixture unavailable: %+v", results)
	}
	articles := call(guest, "GET", "/api/v1/public/articles/", nil, "", 200)
	if rows := articles["items"].([]any); len(rows) != 1 || rows[0].(map[string]any)["id"] != articleID {
		t.Fatalf("native public article fixture unavailable: %+v", articles)
	}
	call(guest, "GET", "/api/v1/public/mock-exams?pathId="+p.ID, nil, "", 200)
	products := call(guest, "GET", "/api/v1/commerce/catalog/products?page=1&limit=20", nil, "", 200)
	if rows := products["items"].([]any); len(rows) != 1 || rows[0].(map[string]any)["id"] != product.ID || rows[0].(map[string]any)["priceMinor"] != float64(15000) {
		t.Fatalf("canonical commerce product unavailable: %+v", products)
	}
	call(guest, "GET", "/api/v1/commerce/catalog/payment-options", nil, "", 200)
	if os.Getenv("HEADER_BROWSER_E2E") != "1" {
		t.Log("real HTTP+PostgreSQL checks ran; native browser proof disabled (HEADER_BROWSER_E2E=1 required)")
		return
	}
	web, err := filepath.Abs("../../../apps/web")
	if err != nil {
		t.Fatal(err)
	}
	fixtureEnv := append(os.Environ(), "HEADER_LIVE=1", "HEADER_ADMIN_EMAIL="+admin.Email, "HEADER_STUDENT_EMAIL="+student.Email, "HEADER_PASSWORD=Header-test-pass-42!", "HEADER_PATH_ID="+p.ID, "HEADER_OTHER_PATH_ID="+other.ID, "HEADER_CHILD_PATH_ID="+child.ID, "HEADER_LEVEL_ID="+level.ID, "HEADER_OTHER_LEVEL_ID="+otherLevel.ID, "HEADER_SUBJECT_ID="+subject.ID, "HEADER_COURSE_ID="+courseID, "HEADER_PRODUCT_ID="+product.ID, "HEADER_ARTICLE_ID="+articleID, "HEADER_NOTIFICATION_ID="+notificationID, "PLAYWRIGHT_CHROMIUM_DISABLE_GPU=1", "E2E_API_TARGET="+server.URL)
	reference := exec.CommandContext(ctx, "node", "scripts/parity/header-reference.mjs")
	reference.Dir = filepath.Dir(filepath.Dir(web))
	reference.Env = fixtureEnv
	if output, err := reference.CombinedOutput(); err != nil {
		t.Fatalf("header source reference: %v\n%s", err, output)
	}
	command := exec.CommandContext(ctx, "npm", "run", "e2e", "--", "--workers=1", "tests/e2e/original-header-live.spec.ts")
	command.Dir = web
	command.Env = fixtureEnv
	output, err := command.CombinedOutput()
	t.Log(string(output))
	if err != nil {
		t.Fatalf("native header browser: %v", err)
	}
}
