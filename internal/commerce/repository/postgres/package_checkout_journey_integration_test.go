package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type isolatedAuditStub struct{}

func (isolatedAuditStub) WriteTx(context.Context, pgx.Tx, operations.AuditEvent) error { return nil }

// Requires a dedicated disposable database with all migrations already applied.
func TestIsolatedPackageCheckoutJourney(t *testing.T) {
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
	var admin, student, other, path, subject string
	suffix := fmt.Sprint(time.Now().UnixNano())
	for _, row := range []struct {
		target *string
		name   string
	}{{&admin, "admin"}, {&student, "student"}, {&other, "other"}} {
		if err := db.QueryRow(ctx, `INSERT INTO users(email,name,password_hash) VALUES($1,$2,'not-a-login') RETURNING id::text`, row.name+suffix+"@example.invalid", row.name).Scan(row.target); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.QueryRow(ctx, `INSERT INTO paths(code,name) VALUES($1,'مسار تجريبي') RETURNING id::text`, "P"+suffix).Scan(&path); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO subjects(path_id,code,name) VALUES($1::uuid,'S','مادة تجريبية') RETURNING id::text`, path).Scan(&subject); err != nil {
		t.Fatal(err)
	}
	repo := New(db, isolatedAuditStub{})
	product, err := repo.CreateProduct(ctx, admin, commerce.ProductWrite{Code: "PKG" + suffix, ProductType: commerce.ProductPackage, Name: "باقة تجريبية", Status: commerce.ProductActive, AccessMode: commerce.AccessPaid, PriceMinor: 1000, Currency: "SAR", IsVisible: true, Package: &commerce.PackageWrite{PackageKind: commerce.PackageBundle, Items: []commerce.PackageItem{{ScopeType: commerce.ScopeSubject, SubjectID: subject, ContentType: commerce.ContentBanks}}}})
	if err != nil {
		t.Fatal(err)
	}
	if product.ProductType != commerce.ProductPackage || product.CourseID != "" || product.Package == nil || len(product.Package.Items) != 1 || product.Package.Items[0].ContentType != commerce.ContentBanks {
		t.Fatalf("incorrect package: %+v", product)
	}
	check := func(user string, kind commerce.ContentType, allowed bool) {
		t.Helper()
		d, e := repo.ResolveScopedAccess(ctx, user, nil, path, subject, "", kind, true)
		if e != nil || d.Allowed != allowed {
			t.Fatalf("access %s %s: %+v %v", user, kind, d, e)
		}
	}
	check(student, commerce.ContentBanks, false)
	request, err := repo.CreatePaymentRequest(ctx, student, commerce.CheckoutCreate{ProductID: product.ID, PaymentMethod: commerce.PaymentTransfer, IdempotencyKey: "journey-" + suffix}, commerce.CheckoutPolicy{GatewayMode: commerce.GatewayManualReview, ProviderCode: "manual"}, commerce.RevenuePolicySnapshot{})
	if err != nil {
		t.Fatal(err)
	}
	check(student, commerce.ContentBanks, false)
	paid, err := repo.ReviewPaymentRequest(ctx, admin, request.ID, commerce.PaymentReview{ExpectedRevision: request.Revision, Status: commerce.PaymentPaid, ApprovalEvidence: "isolated test"})
	if err != nil || paid.Status != commerce.PaymentPaid {
		t.Fatalf("review: %+v %v", paid, err)
	}
	check(student, commerce.ContentBanks, true)
	check(student, commerce.ContentTests, false)
	check(other, commerce.ContentBanks, false)
	var grants int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM commerce_entitlements WHERE user_id=$1::uuid AND product_id=$2::uuid AND status='active'`, student, product.ID).Scan(&grants); err != nil || grants != 1 {
		t.Fatalf("expected one active entitlement, got %d: %v", grants, err)
	}
	if _, err := repo.ReviewPaymentRequest(ctx, admin, request.ID, commerce.PaymentReview{ExpectedRevision: request.Revision, Status: commerce.PaymentPaid, ApprovalEvidence: "duplicate"}); err == nil {
		t.Fatal("duplicate payment approval must be rejected")
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM commerce_entitlements WHERE user_id=$1::uuid AND product_id=$2::uuid AND status='active'`, student, product.ID).Scan(&grants); err != nil || grants != 1 {
		t.Fatalf("duplicate approval changed entitlements: %d %v", grants, err)
	}
}
