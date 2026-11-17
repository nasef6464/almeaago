package commercehttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	commerceapp "github.com/nasef6464/almeaago/internal/commerce/application"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

// Embed the repository contract to make an unexpected write fail immediately;
// the actual public application service is exercised by these HTTP tests.
type publicCatalogRouteRepository struct {
	commerceapp.Repository
	product       commerce.Product
	reads         int
	page          int
	limit         int
	scopedPath    string
	scopedSubject string
	scopedType    commerce.ContentType
}

func (r *publicCatalogRouteRepository) ListScopedPublicCatalog(_ context.Context, page, limit int, path, subject string, kind commerce.ContentType) (commerce.PublicCatalogPage, error) {
	r.reads++
	r.scopedPath, r.scopedSubject, r.scopedType = path, subject, kind
	return commerce.PublicCatalogPage{Page: page, Limit: limit, Items: []commerce.PublicProduct{{ID: r.product.ID}}}, nil
}

type publicCatalogRouteTaxonomy struct{}

func (publicCatalogRouteTaxonomy) ValidCommerceScope(context.Context, string, string) (bool, error) {
	return true, nil
}
func (publicCatalogRouteTaxonomy) PublicCommerceScopeVisible(_ context.Context, path, subject string) (bool, error) {
	return path == "00000000-0000-0000-0000-000000000001" && (subject == "" || subject == "00000000-0000-0000-0000-000000000002"), nil
}

func TestPublicCatalogRouteScopesSubjectAndContent(t *testing.T) {
	repo := &publicCatalogRouteRepository{product: commerce.Product{ID: "membership-1", ProductType: commerce.ProductMembership, Name: "عضوية", Status: commerce.ProductActive, AccessMode: commerce.AccessPaid, PriceMinor: 100, Currency: "SAR", IsVisible: true, Package: &commerce.Package{PackageKind: commerce.PackageMembership, Items: []commerce.PackageItem{{ScopeType: commerce.ScopeAll}}}}}
	h := New(commerceapp.NewService(repo, nil, publicCatalogRouteTaxonomy{}, nil), nil)
	response := httptest.NewRecorder()
	h.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/catalog/products?pathId=00000000-0000-0000-0000-000000000001&subjectId=00000000-0000-0000-0000-000000000002&contentType=banks", nil))
	if response.Code != http.StatusOK || repo.scopedPath != "00000000-0000-0000-0000-000000000001" || repo.scopedSubject != "00000000-0000-0000-0000-000000000002" || repo.scopedType != commerce.ContentBanks {
		t.Fatalf("scoped route: status=%d repo=%+v body=%s", response.Code, repo, response.Body.String())
	}
	response = httptest.NewRecorder()
	h.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/catalog/products?pathId=00000000-0000-0000-0000-000000000001&subjectId=00000000-0000-0000-0000-000000000099&contentType=banks", nil))
	if response.Code != http.StatusNotFound || repo.reads != 1 {
		t.Fatalf("foreign subject was accepted: status=%d reads=%d", response.Code, repo.reads)
	}
}

func (r *publicCatalogRouteRepository) ListPublicCatalog(_ context.Context, page, limit int, _ string) (commerce.PublicCatalogPage, error) {
	r.reads++
	r.page, r.limit = page, limit
	return commerce.PublicCatalogPage{Page: page, Limit: limit, Items: []commerce.PublicProduct{{ID: r.product.ID}}}, nil
}

func (r *publicCatalogRouteRepository) GetProduct(context.Context, string) (commerce.Product, error) {
	return r.product, nil
}

func TestPublicCatalogRouteUsesCanonicalProjectionWithoutAuthentication(t *testing.T) {
	repo := &publicCatalogRouteRepository{product: commerce.Product{
		ID: "membership-1", Code: "INTERNAL-CODE-PRIVATE", ProductType: commerce.ProductPackage,
		Name: "عضوية المنصة", Description: "وصف العضوية", Status: commerce.ProductActive,
		AccessMode: commerce.AccessPaid, PriceMinor: 15000, Currency: "SAR", IsVisible: true,
		Revision: 7, Package: &commerce.Package{PackageKind: commerce.PackageMembership, Items: []commerce.PackageItem{{ScopeType: commerce.ScopeAll}}},
	}}
	service := commerceapp.NewService(repo, nil, nil, nil)
	// Use the production constructor, with no authenticator: this endpoint is
	// public, while its owning service still enforces product visibility.
	handler := NewWithProviderSecrets(service, nil, nil, nil, nil, "")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/catalog/products?page=2&limit=100", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("catalog status=%d body=%s", response.Code, response.Body.String())
	}
	var page commerce.PublicCatalogPage
	if err := json.Unmarshal(response.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if repo.reads != 1 || repo.page != 2 || repo.limit != 100 || page.Page != 2 || page.Limit != 100 || len(page.Items) != 1 {
		t.Fatalf("public pagination/service not preserved: repository=%+v response=%s", repo, response.Body.String())
	}
	item := page.Items[0]
	if item.ID != repo.product.ID || item.Name != repo.product.Name || item.PriceMinor != 15000 || item.Currency != "SAR" || !item.PublicMembership || !reflect.DeepEqual(item.ContentTypes, []commerce.ContentType{commerce.ContentAll}) {
		t.Fatalf("canonical storefront projection changed: %+v", item)
	}
	var projection struct {
		Items []map[string]json.RawMessage `json:"items"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &projection); err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"code", "revision", "package", "scopeType", "accessMode"} {
		if _, exists := projection.Items[0][forbidden]; exists {
			t.Fatalf("public response leaked internal field %s: %s", forbidden, response.Body.String())
		}
	}
	repo.product.IsVisible = false
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/catalog/products", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("hidden catalog status=%d body=%s", response.Code, response.Body.String())
	}
	if err := json.Unmarshal(response.Body.Bytes(), &page); err != nil || len(page.Items) != 0 {
		t.Fatalf("hidden product leaked: err=%v body=%s", err, response.Body.String())
	}
}

func TestPublicCatalogRouteRetainsPaginationAndScopeValidation(t *testing.T) {
	repo := &publicCatalogRouteRepository{}
	handler := New(commerceapp.NewService(repo, nil, nil, nil), nil)
	for _, query := range []string{"page=not-a-number", "limit=101", "page=-1", "pathId=not-a-uuid", "subjectId=not-a-uuid", "contentType=banks", "pathId=00000000-0000-0000-0000-000000000001&contentType=invalid", "pathId=00000000-0000-0000-0000-000000000001&contentType=all"} {
		t.Run(query, func(t *testing.T) {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/catalog/products?"+query, nil))
			if response.Code != http.StatusBadRequest {
				t.Fatalf("invalid query status=%d body=%s", response.Code, response.Body.String())
			}
		})
	}
	if repo.reads != 0 {
		t.Fatal("invalid public query reached persistence")
	}
}

func TestPublicPaymentOptionsRouteReflectsConfiguredGatewayWithoutAuthentication(t *testing.T) {
	for _, tc := range []struct {
		name string
		mode commerce.GatewayMode
		want []commerce.PaymentMethod
	}{
		{name: "manual", mode: commerce.GatewayManualReview, want: []commerce.PaymentMethod{commerce.PaymentCard, commerce.PaymentTransfer, commerce.PaymentWallet}},
		{name: "payment_link_without_provider_fails_closed", mode: commerce.GatewayPaymentLink, want: []commerce.PaymentMethod{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			checkout := commerceapp.NewCheckoutService(nil, commerce.CheckoutPolicy{GatewayMode: tc.mode, ProviderCode: "tap"})
			handler := NewWithProviderSecrets(nil, checkout, nil, nil, nil, "")
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/catalog/payment-options", nil))
			if response.Code != http.StatusOK {
				t.Fatalf("payment options status=%d body=%s", response.Code, response.Body.String())
			}
			var options commerceapp.PublicPaymentOptions
			if err := json.Unmarshal(response.Body.Bytes(), &options); err != nil {
				t.Fatal(err)
			}
			if options.GatewayMode != tc.mode || !reflect.DeepEqual(options.Methods, tc.want) {
				t.Fatalf("payment availability changed: %+v", options)
			}
			response = httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/checkout/requests", strings.NewReader(`{}`)))
			if response.Code != http.StatusServiceUnavailable {
				t.Fatalf("public options bypassed checkout authentication: %d", response.Code)
			}
		})
	}
}

func TestPublicPaymentOptionsNotMountedWithoutCheckout(t *testing.T) {
	response := httptest.NewRecorder()
	New(nil, nil).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/catalog/payment-options", nil))
	if response.Code != http.StatusNotFound {
		t.Fatalf("unconfigured checkout options must not invoke nil service: %d", response.Code)
	}
}
