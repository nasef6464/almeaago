package discoveryhttp

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	contentpg "github.com/nasef6464/almeaago/internal/content/repository/postgres"
	discoveryapp "github.com/nasef6464/almeaago/internal/discovery/application"
	discovery "github.com/nasef6464/almeaago/internal/discovery/domain"
	questionpg "github.com/nasef6464/almeaago/internal/questionbank/repository/postgres"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"
)

// Compile-time boundaries: Discovery cannot call unrestricted list/detail readers.
var _ discoveryapp.ContentReader = (*contentpg.Repository)(nil)
var _ discoveryapp.QuestionReader = (*questionpg.Repository)(nil)

func TestPublicSearchHTTPPostgres(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL required: public search persistence/privacy fixtures not run")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
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
	// Real migrated column types/checks/defaults, isolated to this single connection.
	for _, table := range []string{"paths", "levels", "subjects", "courses", "lessons", "course_modules", "course_lessons", "foundation_topics", "topic_lessons", "questions", "question_versions"} {
		if _, err = db.Exec(ctx, `CREATE TEMP TABLE `+table+` (LIKE public.`+table+` INCLUDING ALL)`); err != nil {
			t.Fatal(err)
		}
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	id := func(n int) string { return fmt.Sprintf("00000000-0000-0000-0000-%012d", n) }
	path, subject, level := id(1), id(2), id(3)
	exec(`INSERT INTO paths(id,code,name)VALUES($1,'public','Public')`, path)
	exec(`INSERT INTO levels(id,path_id,code,name)VALUES($1,$2,'level','Level')`, level, path)
	exec(`INSERT INTO subjects(id,path_id,level_id,code,name)VALUES($1,$2,$3,'subject','Subject')`, subject, path, level)
	course := id(10)
	exec(`INSERT INTO courses(id,path_id,subject_id,title,description,workflow_status,is_published)VALUES($1,$2,$3,'Needle course','literal %_\\ marker','approved',true)`, course, path, subject)
	for n, mutation := range []string{"workflow_status='draft',is_published=false", "is_published=false", "is_visible=false", "owner_type='school',owner_school_id='00000000-0000-0000-0000-000000000999'", "owner_type='teacher',owner_user_id='00000000-0000-0000-0000-000000000999'"} {
		cid := id(20 + n)
		exec(`INSERT INTO courses(id,path_id,subject_id,title,workflow_status,is_published)VALUES($1,$2,$3,'Needle hidden','approved',true)`, cid, path, subject)
		exec(`UPDATE courses SET `+mutation+` WHERE id=$1`, cid)
	}
	topic := id(40)
	exec(`INSERT INTO foundation_topics(id,path_id,subject_id,code,title)VALUES($1,$2,$3,'topic','Topic')`, topic, path, subject)
	lesson := id(41)
	exec(`INSERT INTO lessons(id,path_id,subject_id,title,description,lesson_type,content_text,workflow_status)VALUES($1,$2,$3,'Public lesson','A description','text','Needle foundation body','approved')`, lesson, path, subject)
	exec(`INSERT INTO topic_lessons(topic_id,lesson_id)VALUES($1,$2)`, topic, lesson)
	// Unplaced/locked/private/draft rows must not become content inference channels.
	for n, mutation := range []string{"is_locked=true", "is_visible=false", "workflow_status='draft'", "owner_type='school',owner_school_id='00000000-0000-0000-0000-000000000999'", "owner_type='teacher',owner_user_id='00000000-0000-0000-0000-000000000999'"} {
		lid := id(50 + n)
		exec(`INSERT INTO lessons(id,path_id,subject_id,title,lesson_type,content_text,workflow_status)VALUES($1,$2,$3,'Needle hidden','text','Needle hidden body','approved')`, lid, path, subject)
		exec(`INSERT INTO topic_lessons(topic_id,lesson_id)VALUES($1,$2)`, topic, lid)
		exec(`UPDATE lessons SET `+mutation+` WHERE id=$1`, lid)
	}
	unplaced := id(60)
	exec(`INSERT INTO lessons(id,path_id,subject_id,title,lesson_type,workflow_status)VALUES($1,$2,$3,'Needle unplaced','text','approved')`, unplaced, path, subject)
	// Public course preview is discoverable, but a paid non-preview placement is not.
	module := id(61)
	exec(`INSERT INTO course_modules(id,course_id,title)VALUES($1,$2,'Module')`, module, course)
	for n, preview := range []bool{true, false} {
		lid := id(62 + n)
		exec(`INSERT INTO lessons(id,path_id,subject_id,title,lesson_type,workflow_status)VALUES($1,$2,$3,'Needle course lesson','text','approved')`, lid, path, subject)
		exec(`INSERT INTO course_lessons(module_id,lesson_id,is_preview)VALUES($1,$2,$3)`, module, lid, preview)
	}
	question := id(70)
	longText := "Needle " + strings.Repeat("س", 150)
	exec(`INSERT INTO questions(id,question_code,path_id,subject_id,workflow_status,current_version)VALUES($1,'public-question',$2,$3,'approved',2)`, question, path, subject)
	exec(`INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index,explanation,difficulty)VALUES($1,1,'mcq','HistoricalBodySecret',1,'Historic explanation','easy'),($1,2,'mcq',$2,2,'PrivateExplanationSecret','hard')`, question, longText)
	for n, owner := range []string{"school", "teacher"} {
		qid := id(71 + n)
		exec(`INSERT INTO questions(id,question_code,path_id,subject_id,workflow_status,owner_type,owner_id)VALUES($1,$2,$3,$4,'approved',$5,$6)`, qid, fmt.Sprint(n), path, subject, owner, id(999))
		exec(`INSERT INTO question_versions(question_id,version,question_type,text_content)VALUES($1,1,'essay','Needle private question')`, qid)
	}
	qdraft := id(74)
	exec(`INSERT INTO questions(id,question_code,path_id,subject_id,workflow_status)VALUES($1,'draft-question',$2,$3,'draft')`, qdraft, path, subject)
	exec(`INSERT INTO question_versions(question_id,version,question_type,text_content)VALUES($1,1,'essay','Needle draft question')`, qdraft)
	handler := New(discoveryapp.NewService(contentpg.New(db, nil), questionpg.New(db, nil)))
	search := func(q, kind string, limit int) discovery.Payload {
		t.Helper()
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", "/?q="+url.QueryEscape(q)+"&type="+kind+"&limit="+fmt.Sprint(limit), nil))
		if w.Code != 200 {
			t.Fatalf("HTTP %d: %s", w.Code, w.Body.String())
		}
		var out discovery.Payload
		if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		if strings.Contains(w.Body.String(), "PrivateExplanationSecret") || strings.Contains(w.Body.String(), "correctOption") {
			t.Fatal("private question projection leaked")
		}
		return out
	}
	// Articles reuse the same guarded Content projection and explicit page boundaries.
	articleHandler := NewArticles(discoveryapp.NewArticleService(contentpg.New(db, nil)))
	articles := func(page, limit int) discovery.ArticlePage {
		t.Helper()
		w := httptest.NewRecorder()
		articleHandler.ServeHTTP(w, httptest.NewRequest("GET", fmt.Sprintf("/?page=%d&limit=%d", page, limit), nil))
		if w.Code != 200 {
			t.Fatalf("articles HTTP %d %s", w.Code, w.Body.String())
		}
		var out discovery.ArticlePage
		if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		if strings.Contains(w.Body.String(), "Needle foundation body") {
			t.Fatal("article body leaked")
		}
		return out
	}
	first := articles(1, 1)
	second := articles(2, 1)
	if len(first.Items) != 1 || !first.HasMore || len(second.Items) != 1 || second.HasMore || first.Items[0].ID == second.Items[0].ID {
		t.Fatalf("article pages: %#v %#v", first, second)
	}
	exec(`UPDATE lessons SET approved_at=to_timestamp(1760000000.123) WHERE id=$1`, lesson)
	dated := articles(1, 20)
	if len(dated.Items) != 2 || dated.Items[0].ApprovedAt == nil || *dated.Items[0].ApprovedAt != 1760000000123 {
		t.Fatalf("canonical article date: %#v", dated)
	}
	out := search("Needle", "all", 20)
	if len(out.Results.Courses) != 1 || len(out.Results.Lessons) != 2 || len(out.Results.Questions) != 1 {
		t.Fatalf("privacy filters: %#v", out.Results)
	}
	if len([]rune(out.Results.Questions[0].Title)) != 120 || out.Results.Questions[0].Subtitle != "hard" || out.Results.Questions[0].Route != "/category/"+path+"?subject="+subject+"&tab=tests" {
		t.Fatal(out.Results.Questions)
	}
	for _, keyword := range []string{"HistoricalBodySecret", "PrivateExplanationSecret"} {
		if got := search(keyword, "question", 20); len(got.Results.Questions) != 0 {
			t.Fatalf("private inference/version leak: %s", keyword)
		}
	}
	for _, literal := range []string{"%_", "\\"} {
		if got := search(literal, "all", 20); len(got.Results.Courses) != 1 || len(got.Results.Lessons) != 0 || len(got.Results.Questions) != 0 {
			t.Fatalf("LIKE metacharacter expanded: %q %#v", literal, got.Results)
		}
	}
	if got := search("Needle", "lesson", 1); len(got.Results.Lessons) != 1 || len(got.Results.Courses) != 0 || len(got.Results.Questions) != 0 {
		t.Fatal(got.Results)
	}
	for _, change := range []struct {
		sql  string
		args []any
	}{{`UPDATE foundation_topics SET is_locked=true WHERE id=$1`, []any{topic}}, {`UPDATE courses SET is_visible=false WHERE id=$1`, []any{course}}} {
		exec(change.sql, change.args...)
	}
	if got := search("Needle", "lesson", 20); len(got.Results.Lessons) != 0 {
		t.Fatalf("locked topic/hidden course leaked: %#v", got.Results)
	}
	if got := articles(1, 20); len(got.Items) != 0 {
		t.Fatal("articles bypassed shared placement guards", got)
	}
	exec(`UPDATE levels SET status='archived' WHERE id=$1`, level)
	if got := search("Needle", "all", 20); len(got.Results.Courses)+len(got.Results.Lessons)+len(got.Results.Questions) != 0 {
		t.Fatal("archived level leaked", got.Results)
	}
	exec(`UPDATE levels SET status='active' WHERE id=$1`, level)
	exec(`UPDATE subjects SET status='archived' WHERE id=$1`, subject)
	if got := search("Needle", "question", 20); len(got.Results.Questions) != 0 {
		t.Fatal("archived subject leaked")
	}
	exec(`UPDATE subjects SET status='active' WHERE id=$1`, subject)
	parent := id(90)
	exec(`INSERT INTO paths(id,code,name,status)VALUES($1,'parent','Parent','inactive')`, parent)
	exec(`UPDATE paths SET parent_path_id=$2 WHERE id=$1`, path, parent)
	if got := search("Needle", "all", 20); len(got.Results.Courses)+len(got.Results.Lessons)+len(got.Results.Questions) != 0 {
		t.Fatal("inactive ancestor leaked", got.Results)
	}
}
