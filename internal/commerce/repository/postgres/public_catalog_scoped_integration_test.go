package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

func TestScopedPublicCatalogPaginationPostgres(t *testing.T) {
	dsn := os.Getenv("COMMERCE_JOURNEY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("use a disposable local database via COMMERCE_JOURNEY_TEST_DATABASE_URL")
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
CREATE TEMP TABLE commerce_products(id uuid, product_type text, name text, description text, price_minor bigint, currency text, status text, is_visible boolean, access_mode text, course_id uuid);
CREATE TEMP TABLE commerce_packages(id uuid, product_id uuid, package_kind text);
CREATE TEMP TABLE commerce_package_items(package_id uuid, scope_type text, path_id uuid, subject_id uuid, course_id uuid, content_type text);
CREATE TEMP TABLE subjects(id uuid, path_id uuid);
CREATE TEMP TABLE courses(id uuid, path_id uuid);
INSERT INTO subjects VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001');
INSERT INTO commerce_products SELECT md5(name)::uuid,'package',name,'',row_number() OVER (ORDER BY name),'SAR','active',true,'paid',NULL FROM unnest(ARRAY['path','subject','global','wrong-subject','wrong-kind','split-items','single-course','other-path']) name;
INSERT INTO commerce_packages SELECT id,id,'bundle' FROM commerce_products;
INSERT INTO commerce_package_items VALUES
 (md5('path')::uuid,'path','00000000-0000-0000-0000-000000000001',NULL,NULL,'banks'),
 (md5('other-path')::uuid,'path','00000000-0000-0000-0000-000000000009',NULL,NULL,'banks'),
 (md5('subject')::uuid,'subject',NULL,'00000000-0000-0000-0000-000000000002',NULL,'banks'),
 (md5('global')::uuid,'all',NULL,NULL,NULL,NULL),
 (md5('wrong-subject')::uuid,'subject',NULL,'00000000-0000-0000-0000-000000000003',NULL,'banks'),
 (md5('wrong-kind')::uuid,'subject',NULL,'00000000-0000-0000-0000-000000000002',NULL,'tests'),
 (md5('split-items')::uuid,'subject',NULL,'00000000-0000-0000-0000-000000000002',NULL,'tests'),
 (md5('split-items')::uuid,'subject',NULL,'00000000-0000-0000-0000-000000000003',NULL,'banks'),
 (md5('single-course')::uuid,'course',NULL,NULL,'00000000-0000-0000-0000-000000000004',NULL);`)
	if err != nil {
		t.Fatal(err)
	}
	repo := New(db, nil)
	path := "00000000-0000-0000-0000-000000000001"
	subject := "00000000-0000-0000-0000-000000000002"
	seen := map[string]bool{}
	for page := 1; page <= 4; page++ {
		result, err := repo.ListScopedPublicCatalog(ctx, page, 1, path, subject, commerce.ContentBanks)
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range result.Items {
			seen[item.Name] = true
		}
		if !result.HasMore {
			break
		}
	}
	if len(seen) != 3 || !seen["path"] || !seen["subject"] || !seen["global"] {
		t.Fatalf("incorrect filtered pages: %+v", seen)
	}
	courses, err := repo.ListScopedPublicCatalog(ctx, 1, 20, path, subject, commerce.ContentCourses)
	if err != nil || len(courses.Items) != 1 || courses.Items[0].Name != "global" {
		t.Fatalf("specific course leaked into subject-wide course scope: %+v %v", courses, err)
	}
}
