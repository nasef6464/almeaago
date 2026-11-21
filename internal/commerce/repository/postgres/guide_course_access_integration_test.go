package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestGuideCourseGuestAndExistingAccessPoliciesPostgres(t *testing.T) {
	dsn := os.Getenv("COMMERCE_JOURNEY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires disposable local PostgreSQL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 1
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	_, err = db.Exec(ctx, `
CREATE TEMP TABLE commerce_products(id uuid,product_type text,course_id uuid,status text,is_visible bool,access_mode text);
CREATE TEMP TABLE commerce_packages(id uuid,product_id uuid,seat_capacity int);
CREATE TEMP TABLE commerce_package_items(package_id uuid,scope_type text,course_id uuid,path_id uuid,subject_id uuid,content_type text);
CREATE TEMP TABLE commerce_entitlements(id uuid,subject_type text,user_id uuid,school_id uuid,product_id uuid,status text,starts_at timestamptz,expires_at timestamptz,created_at timestamptz);
INSERT INTO commerce_products VALUES
 ('00000000-0000-0000-0000-000000000011','course','00000000-0000-0000-0000-000000000001','active',true,'free'),
 ('00000000-0000-0000-0000-000000000012','course','00000000-0000-0000-0000-000000000002','active',true,'paid'),
 ('00000000-0000-0000-0000-000000000013','package',NULL,'active',true,'paid'),
 ('00000000-0000-0000-0000-000000000014','package',NULL,'active',true,'paid');
INSERT INTO commerce_packages VALUES ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000013',NULL),('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000014',NULL);
INSERT INTO commerce_package_items VALUES ('00000000-0000-0000-0000-000000000041','subject',NULL,NULL,'00000000-0000-0000-0000-000000000032','courses'),('00000000-0000-0000-0000-000000000042','path',NULL,'00000000-0000-0000-0000-000000000031',NULL,'courses');
INSERT INTO commerce_entitlements VALUES
 ('00000000-0000-0000-0000-000000000051','user','00000000-0000-0000-0000-000000000021',NULL,'00000000-0000-0000-0000-000000000012','active',now()-interval '1 day',NULL,now()),
 ('00000000-0000-0000-0000-000000000052','user','00000000-0000-0000-0000-000000000022',NULL,'00000000-0000-0000-0000-000000000013','active',now()-interval '1 day',NULL,now()),
 ('00000000-0000-0000-0000-000000000053','school',NULL,'00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000014','active',now()-interval '1 day',NULL,now());
`)
	if err != nil {
		t.Fatal(err)
	}
	repo := New(db, nil)
	free, err := repo.ResolveGuestGuideCourseAccess(ctx, "00000000-0000-0000-0000-000000000001")
	if err != nil || !free.Configured || !free.Allowed || free.Reason != "free_product" {
		t.Fatalf("guest free=%+v err=%v", free, err)
	}
	paid, err := repo.ResolveGuestGuideCourseAccess(ctx, "00000000-0000-0000-0000-000000000002")
	if err != nil || !paid.Configured || paid.Allowed || paid.Reason != "paid_required" {
		t.Fatalf("guest paid=%+v err=%v", paid, err)
	}
	unknown, err := repo.ResolveGuestGuideCourseAccess(ctx, "00000000-0000-0000-0000-000000000003")
	if err != nil || unknown.Configured {
		t.Fatalf("unconfigured=%+v err=%v", unknown, err)
	}
	for _, tc := range []struct {
		name, user string
		schools    []string
		allowed    bool
		reason     string
	}{
		{"individual", "00000000-0000-0000-0000-000000000021", nil, true, "user_entitlement"},
		{"bundle", "00000000-0000-0000-0000-000000000022", nil, true, "user_entitlement"},
		{"school", "00000000-0000-0000-0000-000000000024", []string{"00000000-0000-0000-0000-000000000023"}, true, "school_entitlement"},
		{"other", "00000000-0000-0000-0000-000000000025", nil, false, "paid_required"},
	} {
		result, err := repo.ResolveCourseAccess(ctx, tc.user, tc.schools, "00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000031", "00000000-0000-0000-0000-000000000032")
		if err != nil || result.Allowed != tc.allowed || result.Reason != tc.reason {
			t.Fatalf("%s=%+v err=%v", tc.name, result, err)
		}
	}
}
