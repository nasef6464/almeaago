package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

// Requires a disposable database; never run against a shared environment.
func TestScopedPackageContentPostgres(t *testing.T) {
	url := os.Getenv("COMMERCE_ISOLATED_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("COMMERCE_ISOLATED_TEST_DATABASE_URL is not set")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("commerce_test_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE") }()
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ddl := `CREATE TABLE commerce_products(id uuid, product_type text, course_id uuid, status text, is_visible boolean);
 CREATE TABLE commerce_packages(id uuid, product_id uuid, seat_capacity integer);
 CREATE TABLE commerce_entitlements(id uuid, subject_type text, product_id uuid, user_id uuid, school_id uuid, source_type text, status text, starts_at timestamptz, expires_at timestamptz, created_at timestamptz);
 CREATE TABLE commerce_package_items(package_id uuid,scope_type text,course_id uuid,path_id uuid,subject_id uuid,content_type text, CONSTRAINT commerce_package_items_target_shape CHECK (scope_type='all'))`
	if _, err = db.Exec(ctx, ddl); err != nil {
		t.Fatal(err)
	}
	migration, err := os.ReadFile("../../../../migrations/000051_package_scoped_content_types.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(migration)); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, `INSERT INTO commerce_products VALUES ('00000000-0000-0000-0000-000000000001','package',NULL,'active',true);
 INSERT INTO commerce_packages VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',NULL);
 INSERT INTO commerce_entitlements VALUES ('00000000-0000-0000-0000-000000000003','user','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004',NULL,'manual','active',now(),NULL,now());
 INSERT INTO commerce_package_items VALUES ('00000000-0000-0000-0000-000000000002','subject',NULL,NULL,'00000000-0000-0000-0000-000000000005','tests')`)
	if err != nil {
		t.Fatal(err)
	}
	repo := New(db, nil)
	for _, tt := range []struct {
		name, subject string
		kind          commerce.ContentType
		allowed       bool
	}{
		{"matching test", "00000000-0000-0000-0000-000000000005", commerce.ContentTests, true},
		{"other subject", "00000000-0000-0000-0000-000000000006", commerce.ContentTests, false},
		{"other content", "00000000-0000-0000-0000-000000000005", commerce.ContentFoundation, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got, e := repo.ResolveScopedAccess(ctx, "00000000-0000-0000-0000-000000000004", nil, "00000000-0000-0000-0000-000000000007", tt.subject, "", tt.kind, true)
			if e != nil || got.Allowed != tt.allowed {
				t.Fatalf("got %+v, err %v", got, e)
			}
		})
	}
	if _, err := db.Exec(ctx, `UPDATE commerce_package_items SET scope_type='path',path_id='00000000-0000-0000-0000-000000000007',subject_id=NULL`); err != nil {
		t.Fatal(err)
	}
	for _, tt := range []struct {
		path    string
		kind    commerce.ContentType
		allowed bool
	}{
		{"00000000-0000-0000-0000-000000000007", commerce.ContentTests, true},
		{"00000000-0000-0000-0000-000000000008", commerce.ContentTests, false},
		{"00000000-0000-0000-0000-000000000007", commerce.ContentFoundation, false},
	} {
		got, err := repo.ResolveScopedAccess(ctx, "00000000-0000-0000-0000-000000000004", nil, tt.path, "00000000-0000-0000-0000-000000000005", "", tt.kind, true)
		if err != nil || got.Allowed != tt.allowed {
			t.Fatalf("path=%s kind=%s got=%+v err=%v", tt.path, tt.kind, got, err)
		}
	}
}
