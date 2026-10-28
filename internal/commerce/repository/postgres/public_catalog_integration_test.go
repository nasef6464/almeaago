package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	commerceapp "github.com/nasef6464/almeaago/internal/commerce/application"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	commercehttp "github.com/nasef6464/almeaago/internal/commerce/transport/http"
	contentpg "github.com/nasef6464/almeaago/internal/content/repository/postgres"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	taxonomypg "github.com/nasef6464/almeaago/internal/taxonomy/repository/postgres"
)

type guestCatalogAuth struct{}

func (guestCatalogAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{}, errors.New("guest")
}
func (guestCatalogAuth) VerifyCSRF(identityapp.Authenticated, string) error {
	return errors.New("guest")
}

// Run against a migrated isolated DATABASE_URL. Every write lands in a
// session-local shadow table, including the real checkout and audit writers.
func TestPublicCatalogHTTPPostgres(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL required")
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
	for _, name := range []string{"paths", "subjects", "courses", "users", "commerce_products", "commerce_packages", "commerce_package_items", "commerce_payment_requests", "audit_logs"} {
		if _, err = db.Exec(ctx, "CREATE TEMP TABLE "+name+" (LIKE public."+name+" INCLUDING ALL)"); err != nil {
			t.Fatal(err)
		}
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, e := db.Exec(ctx, sql, args...); e != nil {
			t.Fatal(e)
		}
	}
	exec(`INSERT INTO users(id,email,name,password_hash) VALUES('00000000-0000-0000-0000-000000000001','catalog-test@example.test','Catalog learner','unused')`)
	ids := map[string]string{}
	for _, test := range []struct {
		code, status, mode string
		visible            bool
		price              int64
	}{{"VISIBLE", "active", "paid", true, 15000}, {"HIDDEN", "active", "paid", false, 15000}, {"ARCHIVED", "archived", "paid", true, 15000}, {"INACTIVE", "inactive", "paid", true, 15000}, {"FREE", "active", "free", true, 0}, {"ZERO", "active", "paid", true, 0}, {"SCHOOL", "active", "paid", true, 15000}} {
		var id string
		if err = db.QueryRow(ctx, `INSERT INTO commerce_products(code,product_type,name,description,status,access_mode,price_minor,currency,is_visible) VALUES($1,'membership',$1,'public description',$2,$3,$4,'SAR',$5) RETURNING id::text`, test.code, test.status, test.mode, test.price, test.visible).Scan(&id); err != nil {
			t.Fatal(err)
		}
		ids[test.code] = id
		var packageID string
		kind := "membership"
		if test.code == "SCHOOL" {
			kind = "school"
		}
		if err = db.QueryRow(ctx, `INSERT INTO commerce_packages(product_id,package_kind) VALUES($1::uuid,$2) RETURNING id::text`, id, kind).Scan(&packageID); err != nil {
			t.Fatal(err)
		}
		exec(`INSERT INTO commerce_package_items(package_id,scope_type) VALUES($1::uuid,'all')`, packageID)
	}
	repo := New(db, operationspg.NewAuditWriter())
	svc := commerceapp.NewService(repo, contentpg.New(db, nil), taxonomypg.New(db), nil)
	checkout := commerceapp.NewCheckoutService(repo, commerce.CheckoutPolicy{GatewayMode: commerce.GatewayManualReview, ProviderCode: "manual"})
	h := commercehttp.NewWithCheckout(svc, checkout, guestCatalogAuth{}, nil)
	call := func(path string, want int) *httptest.ResponseRecorder {
		t.Helper()
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != want {
			t.Fatalf("%s: want %d got %d %s", path, want, w.Code, w.Body.String())
		}
		return w
	}
	w := call("/catalog/products", 200)
	var body map[string]any
	if err = json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	items := body["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("hidden/inactive/archived/free/zero/school rows leaked: %s", w.Body.String())
	}
	row := items[0].(map[string]any)
	allowed := map[string]bool{"id": true, "productType": true, "name": true, "description": true, "priceMinor": true, "currency": true, "publicMembership": true, "contentTypes": true}
	for key := range row {
		if !allowed[key] {
			t.Fatalf("staff field leaked: %s", key)
		}
	}
	if row["id"] != ids["VISIBLE"] || row["priceMinor"] != float64(15000) || row["publicMembership"] != true {
		t.Fatalf("invalid public projection: %#v", row)
	}
	call("/products", 401)
	call("/entitlements", 401)
	call("/catalog/products?page=-1", 400)
	if _, err = svc.ListProducts(ctx, identity.User{ID: "00000000-0000-0000-0000-000000000001", Roles: []identity.Role{identity.RoleStudent}}, 1, 50, "", "", ""); !errors.Is(err, commerceapp.ErrForbidden) {
		t.Fatalf("student staff listing: %v", err)
	}
	actor := identity.User{ID: "00000000-0000-0000-0000-000000000001", Roles: []identity.Role{identity.RoleStudent}}
	in := commerce.CheckoutCreate{ProductID: ids["VISIBLE"], PaymentMethod: commerce.PaymentCard, IdempotencyKey: "snapshot-one"}
	first, err := checkout.CreateCheckout(ctx, actor, in)
	if err != nil {
		t.Fatal(err)
	}
	if first.OriginalAmountMinor != 15000 || first.FinalAmountMinor != 15000 || first.Currency != "SAR" || first.ProductRevision != 1 {
		t.Fatalf("bad server price snapshot: %#v", first)
	}
	exec(`UPDATE commerce_products SET price_minor=25000,currency='EGP',revision=revision+1 WHERE id=$1::uuid`, ids["VISIBLE"])
	current, err := svc.PublicCatalog(ctx, 1, 50)
	if err != nil || len(current.Items) != 1 || current.Items[0].PriceMinor != 25000 || current.Items[0].Currency != "EGP" {
		t.Fatalf("catalog did not reflect updated price: %#v %v", current, err)
	}
	replay, err := checkout.CreateCheckout(ctx, actor, in)
	if err != nil || replay.ID != first.ID || replay.FinalAmountMinor != 15000 || replay.Currency != "SAR" {
		t.Fatalf("snapshot changed on retry: %#v %v", replay, err)
	}
	exec(`UPDATE commerce_products SET is_visible=false WHERE id=$1::uuid`, ids["VISIBLE"])
	current, err = svc.PublicCatalog(ctx, 1, 50)
	if err != nil || len(current.Items) != 0 {
		t.Fatalf("hidden public row: %#v %v", current, err)
	}
	in.IdempotencyKey = "new-hidden"
	if _, err = checkout.CreateCheckout(ctx, actor, in); !errors.Is(err, commerce.ErrConflict) {
		t.Fatalf("hidden checkout accepted: %v", err)
	}
	in.ProductID = ids["ARCHIVED"]
	in.IdempotencyKey = "new-archived"
	if _, err = checkout.CreateCheckout(ctx, actor, in); !errors.Is(err, commerce.ErrConflict) {
		t.Fatalf("archived checkout accepted: %v", err)
	}
	var grants int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM audit_logs WHERE action='commerce.payment_request.create'`).Scan(&grants); err != nil || grants != 1 {
		t.Fatalf("unexpected checkout audit count %d %v", grants, err)
	}
	// Explicit targets are scoped in PostgreSQL and checked again through the
	// existing Content/Taxonomy owner adapters. Global membership is no fallback.
	const pathA = "00000000-0000-0000-0000-00000000000a"
	const pathB = "00000000-0000-0000-0000-00000000000b"
	const subjectA = "00000000-0000-0000-0000-00000000001a"
	const subjectB = "00000000-0000-0000-0000-00000000001b"
	const courseA = "00000000-0000-0000-0000-00000000002a"
	exec(`INSERT INTO paths(id,code,name) VALUES($1::uuid,'A','Path A'),($2::uuid,'B','Path B')`, pathA, pathB)
	exec(`INSERT INTO subjects(id,path_id,code,name) VALUES($1::uuid,$2::uuid,'A','Subject A'),($3::uuid,$4::uuid,'B','Subject B')`, subjectA, pathA, subjectB, pathB)
	exec(`INSERT INTO courses(id,path_id,subject_id,title,workflow_status,is_published,is_visible) VALUES($1::uuid,$2::uuid,$3::uuid,'Course A','approved',true,true)`, courseA, pathA, subjectA)
	for _, offer := range []struct{ code, scope, target string }{{"P-A", "path", pathA}, {"P-B", "path", pathB}, {"S-A", "subject", subjectA}, {"C-A", "course", courseA}, {"GLOBAL", "all", ""}} {
		var productID, packageID string
		if err = db.QueryRow(ctx, `INSERT INTO commerce_products(code,product_type,name,status,access_mode,price_minor,currency,is_visible) VALUES($1,'package',$1,'active','paid',2500,'SAR',true) RETURNING id::text`, offer.code).Scan(&productID); err != nil {
			t.Fatal(err)
		}
		if err = db.QueryRow(ctx, `INSERT INTO commerce_packages(product_id,package_kind) VALUES($1::uuid,'bundle') RETURNING id::text`, productID).Scan(&packageID); err != nil {
			t.Fatal(err)
		}
		exec(`INSERT INTO commerce_package_items(package_id,scope_type,path_id,subject_id,course_id) VALUES($1::uuid,$2,CASE WHEN $2='path' THEN $3::uuid END,CASE WHEN $2='subject' THEN $3::uuid END,CASE WHEN $2='course' THEN $3::uuid END)`, packageID, offer.scope, func() any {
			if offer.target == "" {
				return nil
			}
			return offer.target
		}())
	}
	exec(`INSERT INTO commerce_products(code,product_type,name,status,access_mode,price_minor,currency,is_visible,course_id) VALUES('COURSE-A','course','Course A','active','paid',3000,'SAR',true,$1::uuid)`, courseA)
	scoped := func(path string, want int) commerce.PublicCatalogPage {
		t.Helper()
		w := call("/catalog/products?pathId="+path, 200)
		var result commerce.PublicCatalogPage
		if e := json.Unmarshal(w.Body.Bytes(), &result); e != nil {
			t.Fatal(e)
		}
		if len(result.Items) != want {
			t.Fatalf("scope %s: want %d got %s", path, want, w.Body.String())
		}
		return result
	}
	a := scoped(pathA, 4)
	for _, p := range a.Items {
		if p.Name == "P-B" || p.Name == "GLOBAL" {
			t.Fatalf("cross-path/global offer leaked: %#v", p)
		}
	}
	b := scoped(pathB, 1)
	if b.Items[0].Name != "P-B" {
		t.Fatalf("wrong B offer: %#v", b)
	}

	exec(`UPDATE courses SET is_visible=false WHERE id=$1::uuid`, courseA)
	scoped(pathA, 2)
	exec(`UPDATE courses SET is_visible=true WHERE id=$1::uuid`, courseA)
	scoped(pathA, 4)
	assertCourseStillVisible := func() {
		t.Helper()
		var eligible bool
		if e := db.QueryRow(ctx, `SELECT workflow_status='approved' AND is_published=true AND is_visible=true FROM courses WHERE id=$1::uuid`, courseA).Scan(&eligible); e != nil || !eligible {
			t.Fatalf("fixture masked taxonomy regression with course flags: %t %v", eligible, e)
		}
	}
	assertAbsent := func(names ...string) {
		t.Helper()
		all, e := svc.PublicCatalog(ctx, 1, 100)
		if e != nil {
			t.Fatal(e)
		}
		for _, p := range all.Items {
			for _, name := range names {
				if p.Name == name {
					t.Fatalf("archived taxonomy remains in unscoped catalog: %#v", p)
				}
			}
		}
	}
	// The course remains approved, published and visible while its subject and
	// its parent path ancestry are archived independently.
	exec(`UPDATE subjects SET status='archived' WHERE id=$1::uuid`, subjectA)
	assertCourseStillVisible()
	scoped(pathA, 1)
	assertAbsent("Course A", "C-A", "S-A")
	exec(`UPDATE subjects SET status='active' WHERE id=$1::uuid`, subjectA)
	scoped(pathA, 4)
	const ancestor = "00000000-0000-0000-0000-00000000000c"
	exec(`INSERT INTO paths(id,code,name) VALUES($1::uuid,'ROOT','Root')`, ancestor)
	exec(`UPDATE paths SET parent_path_id=$2::uuid WHERE id=$1::uuid`, pathA, ancestor)
	exec(`UPDATE paths SET status='archived' WHERE id=$1::uuid`, ancestor)
	assertCourseStillVisible()
	call("/catalog/products?pathId="+pathA, 404)
	assertAbsent("Course A", "C-A", "S-A", "P-A")
	exec(`UPDATE paths SET status='active' WHERE id=$1::uuid`, ancestor)
	scoped(pathA, 4)
	exec(`UPDATE paths SET status='archived' WHERE id=$1::uuid`, pathA)
	assertCourseStillVisible()
	call("/catalog/products?pathId="+pathA, 404)
	assertAbsent("Course A", "C-A", "S-A", "P-A")
	call("/catalog/products?pathId=path-code", 400)

}
