package application

import (
	"context"
	"errors"
	"testing"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type checkoutRepoStub struct {
	product commerce.Product
	preview commerce.DiscountPreview
	request commerce.PaymentRequest
	policy  commerce.CheckoutPolicy
	input   commerce.CheckoutCreate
	revenue commerce.RevenuePolicySnapshot
}

func (r *checkoutRepoStub) GetProduct(context.Context, string) (commerce.Product, error) {
	return r.product, nil
}
func (r *checkoutRepoStub) ListDiscounts(context.Context, int, int, commerce.DiscountStatus, string) (commerce.DiscountPage, error) {
	return commerce.DiscountPage{}, nil
}
func (r *checkoutRepoStub) CreateDiscount(context.Context, string, commerce.DiscountWrite) (commerce.DiscountCode, error) {
	return commerce.DiscountCode{}, nil
}
func (r *checkoutRepoStub) UpdateDiscount(context.Context, string, string, int, commerce.DiscountWrite) (commerce.DiscountCode, error) {
	return commerce.DiscountCode{}, nil
}
func (r *checkoutRepoStub) PreviewDiscount(context.Context, string, string) (commerce.DiscountPreview, error) {
	return r.preview, nil
}
func (r *checkoutRepoStub) CreatePaymentRequest(_ context.Context, _ string, in commerce.CheckoutCreate, p commerce.CheckoutPolicy, revenue commerce.RevenuePolicySnapshot) (commerce.PaymentRequest, error) {
	r.input = in
	r.policy = p
	r.revenue = revenue
	return r.request, nil
}
func (r *checkoutRepoStub) ListUserPaymentRequests(context.Context, string, int, int) (commerce.PaymentRequestPage, error) {
	return commerce.PaymentRequestPage{}, nil
}
func (r *checkoutRepoStub) ListAdminPaymentRequests(context.Context, int, int, commerce.PaymentStatus) (commerce.PaymentRequestPage, error) {
	return commerce.PaymentRequestPage{}, nil
}
func (r *checkoutRepoStub) ReviewPaymentRequest(context.Context, string, string, commerce.PaymentReview) (commerce.PaymentRequest, error) {
	return r.request, nil
}
func (r *checkoutRepoStub) ApplyProviderEvent(context.Context, string, commerce.ProviderEvent) (commerce.ProviderEventResult, error) {
	return commerce.ProviderEventResult{}, nil
}
func (r *checkoutRepoStub) ListRevenueEntries(context.Context, int, int, commerce.RevenueAllocationStatus, commerce.PayoutStatus) (commerce.RevenueEntryPage, error) {
	return commerce.RevenueEntryPage{}, nil
}
func (r *checkoutRepoStub) AllocateRevenue(context.Context, string, string, commerce.RevenueAllocation) (commerce.RevenueEntry, error) {
	return commerce.RevenueEntry{}, nil
}
func (r *checkoutRepoStub) MarkPayoutPaid(context.Context, string, string, commerce.PayoutMarkPaid) (commerce.RevenueEntry, error) {
	return commerce.RevenueEntry{}, nil
}

func checkoutUser() identity.User {
	return identity.User{ID: "user-1", Roles: []identity.Role{identity.RoleStudent}}
}
func checkoutAdmin() identity.User {
	return identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}
}

type revenuePolicyStub struct {
	trainerID string
	share     *float64
	eligible  bool
}

func (s revenuePolicyStub) CourseRevenuePolicy(context.Context, string) (string, *float64, bool, error) {
	return s.trainerID, s.share, s.eligible, nil
}

func TestCheckoutDoesNotAcceptClientPriceAndUsesServerPolicy(t *testing.T) {
	repo := &checkoutRepoStub{request: commerce.PaymentRequest{ID: "pay-1"}}
	s := NewCheckoutService(repo, commerce.CheckoutPolicy{GatewayMode: commerce.GatewayWebhook, ProviderCode: "tap"})
	out, err := s.CreateCheckout(context.Background(), checkoutUser(), commerce.CheckoutCreate{
		ProductID: "product-1", DiscountCode: " save10 ", PaymentMethod: commerce.PaymentCard, IdempotencyKey: "key-1",
	})
	if err != nil || out.ID != "pay-1" {
		t.Fatalf("checkout failed: %#v %v", out, err)
	}
	if repo.policy.GatewayMode != commerce.GatewayWebhook || repo.policy.ProviderCode != "tap" {
		t.Fatalf("unexpected policy: %#v", repo.policy)
	}
	if repo.input.DiscountCode != "SAVE10" {
		t.Fatalf("discount not normalized: %#v", repo.input)
	}
}

func TestManualCheckoutDerivesProviderFromMethod(t *testing.T) {
	repo := &checkoutRepoStub{}
	s := NewCheckoutService(repo, commerce.CheckoutPolicy{})
	_, err := s.CreateCheckout(context.Background(), checkoutUser(), commerce.CheckoutCreate{ProductID: "p", PaymentMethod: commerce.PaymentTransfer, IdempotencyKey: "k"})
	if err != nil {
		t.Fatal(err)
	}
	if repo.policy.GatewayMode != commerce.GatewayManualReview || repo.policy.ProviderCode != "manual_transfer" {
		t.Fatalf("unexpected manual policy: %#v", repo.policy)
	}
}

func TestDiscountRejectsInvalidShape(t *testing.T) {
	repo := &checkoutRepoStub{}
	s := NewCheckoutService(repo, commerce.CheckoutPolicy{})
	bps := 11000
	_, err := s.CreateDiscount(context.Background(), checkoutAdmin(), commerce.DiscountWrite{
		Code: "BAD", DiscountType: commerce.DiscountPercentage, PercentageBPS: &bps, Status: commerce.DiscountActive,
		Scopes: []commerce.DiscountScope{{ScopeType: commerce.DiscountScopeAll}},
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestReviewPaidRequiresEvidence(t *testing.T) {
	s := NewCheckoutService(&checkoutRepoStub{}, commerce.CheckoutPolicy{})
	_, err := s.Review(context.Background(), checkoutAdmin(), "pay-1", commerce.PaymentReview{ExpectedRevision: 1, Status: commerce.PaymentPaid, ApprovalEvidence: "x"})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid evidence, got %v", err)
	}
}

func TestProviderEventRequiresTrustedPaidAmount(t *testing.T) {
	s := NewCheckoutService(&checkoutRepoStub{}, commerce.CheckoutPolicy{})
	_, err := s.ProviderEvent(context.Background(), "tap", commerce.ProviderEvent{EventID: "e1", PaymentRequestID: "p1", Status: commerce.ProviderPaid, PayloadSHA256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid paid event, got %v", err)
	}
}

func TestCourseCheckoutSnapshotsTrainerRevenuePolicy(t *testing.T) {
	share := 35.0
	repo := &checkoutRepoStub{
		product: commerce.Product{
			ID: "product-course-1", ProductType: commerce.ProductCourse, CourseID: "course-1",
			Status: commerce.ProductActive, AccessMode: commerce.AccessPaid, PriceMinor: 12000, Currency: "SAR", IsVisible: true,
		},
		request: commerce.PaymentRequest{ID: "pay-1"},
	}
	service := NewCheckoutService(repo, commerce.CheckoutPolicy{}, revenuePolicyStub{
		trainerID: "trainer-1", share: &share, eligible: true,
	})
	if _, err := service.CreateCheckout(context.Background(), checkoutUser(), commerce.CheckoutCreate{
		ProductID: "product-course-1", PaymentMethod: commerce.PaymentCard, IdempotencyKey: "key-revenue",
	}); err != nil {
		t.Fatal(err)
	}
	if repo.revenue.CourseID != "course-1" || repo.revenue.TrainerUserID != "trainer-1" ||
		repo.revenue.RevenueSharePercentage == nil || *repo.revenue.RevenueSharePercentage != 35 {
		t.Fatalf("unexpected revenue snapshot: %#v", repo.revenue)
	}
}

func TestRevenueMutationsRequireAdminAndEvidence(t *testing.T) {
	service := NewCheckoutService(&checkoutRepoStub{}, commerce.CheckoutPolicy{})
	if _, err := service.AllocateRevenue(context.Background(), checkoutUser(), "rev-1", commerce.RevenueAllocation{
		ExpectedRevision: 1, ProviderFeeMinor: 10, TrainerShareMinor: 20, PlatformShareMinor: 70, Evidence: "settlement",
	}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected admin-only allocation, got %v", err)
	}
	if _, err := service.MarkPayoutPaid(context.Background(), checkoutAdmin(), "rev-1", commerce.PayoutMarkPaid{
		ExpectedRevision: 1, Evidence: "x",
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected payout evidence validation, got %v", err)
	}
}

