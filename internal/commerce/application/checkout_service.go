package application

import (
	"context"
	"regexp"
	"strings"
	"time"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

var discountCodePattern = regexp.MustCompile(`^[A-Z0-9][A-Z0-9_-]{1,79}$`)
var providerCodePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,79}$`)

type CheckoutRepository interface {
	GetProduct(context.Context, string) (commerce.Product, error)
	ListDiscounts(context.Context, int, int, commerce.DiscountStatus, string) (commerce.DiscountPage, error)
	CreateDiscount(context.Context, string, commerce.DiscountWrite) (commerce.DiscountCode, error)
	UpdateDiscount(context.Context, string, string, int, commerce.DiscountWrite) (commerce.DiscountCode, error)
	PreviewDiscount(context.Context, string, string) (commerce.DiscountPreview, error)
	CreatePaymentRequest(context.Context, string, commerce.CheckoutCreate, commerce.CheckoutPolicy, commerce.RevenuePolicySnapshot) (commerce.PaymentRequest, error)
	ListUserPaymentRequests(context.Context, string, int, int) (commerce.PaymentRequestPage, error)
	ListAdminPaymentRequests(context.Context, int, int, commerce.PaymentStatus) (commerce.PaymentRequestPage, error)
	ReviewPaymentRequest(context.Context, string, string, commerce.PaymentReview) (commerce.PaymentRequest, error)
	ApplyProviderEvent(context.Context, string, commerce.ProviderEvent) (commerce.ProviderEventResult, error)
	ListRevenueEntries(context.Context, int, int, commerce.RevenueAllocationStatus, commerce.PayoutStatus) (commerce.RevenueEntryPage, error)
	AllocateRevenue(context.Context, string, string, commerce.RevenueAllocation) (commerce.RevenueEntry, error)
	MarkPayoutPaid(context.Context, string, string, commerce.PayoutMarkPaid) (commerce.RevenueEntry, error)
	AttachProviderSession(context.Context, string, string, int, commerce.ProviderSession) (commerce.PaymentRequest, error)
	FailProviderSession(context.Context, string, string, int, string) (commerce.PaymentRequest, error)
}

type RevenuePolicyResolver interface {
	CourseRevenuePolicy(context.Context, string) (string, *float64, bool, error)
}

type PaymentSessionInitiator interface {
	Initiate(context.Context, commerce.ProviderSessionInit) (commerce.ProviderSession, error)
}

type CheckoutService struct {
	repo      CheckoutRepository
	policy    commerce.CheckoutPolicy
	revenue   RevenuePolicyResolver
	initiator PaymentSessionInitiator
}

func NewCheckoutService(repo CheckoutRepository, policy commerce.CheckoutPolicy, revenue ...RevenuePolicyResolver) *CheckoutService {
	var resolver RevenuePolicyResolver
	if len(revenue) > 0 {
		resolver = revenue[0]
	}
	return NewCheckoutServiceWithProvider(repo, policy, resolver, nil)
}

func NewCheckoutServiceWithProvider(repo CheckoutRepository, policy commerce.CheckoutPolicy, revenue RevenuePolicyResolver, initiator PaymentSessionInitiator) *CheckoutService {
	policy.ProviderCode = strings.ToLower(strings.TrimSpace(policy.ProviderCode))
	if !commerce.ValidGatewayMode(policy.GatewayMode) || policy.ProviderCode == "" || !providerCodePattern.MatchString(policy.ProviderCode) {
		policy.GatewayMode = commerce.GatewayManualReview
		policy.ProviderCode = "manual"
	}
	return &CheckoutService{repo: repo, policy: policy, revenue: revenue, initiator: initiator}
}

func normalizeDiscountWrite(w *commerce.DiscountWrite) error {
	w.Code = strings.ToUpper(strings.TrimSpace(w.Code))
	w.Label = strings.TrimSpace(w.Label)
	if !discountCodePattern.MatchString(w.Code) || len(w.Label) > 160 || !commerce.ValidDiscountType(w.DiscountType) ||
		!commerce.ValidDiscountStatus(w.Status) || w.MinAmountMinor < 0 || w.MaxRedemptions < 0 ||
		len(w.Scopes) == 0 || len(w.Scopes) > 100 {
		return ErrInvalidInput
	}
	if w.StartsAt != nil && w.ExpiresAt != nil && !w.ExpiresAt.After(*w.StartsAt) {
		return ErrInvalidInput
	}
	switch w.DiscountType {
	case commerce.DiscountPercentage:
		if w.PercentageBPS == nil || *w.PercentageBPS < 1 || *w.PercentageBPS > 10000 || w.FixedMinor != nil {
			return ErrInvalidInput
		}
	case commerce.DiscountFixed:
		if w.FixedMinor == nil || *w.FixedMinor < 1 || w.PercentageBPS != nil {
			return ErrInvalidInput
		}
	}
	seen := map[string]struct{}{}
	out := make([]commerce.DiscountScope, 0, len(w.Scopes))
	for _, s := range w.Scopes {
		s.ProductID = strings.TrimSpace(s.ProductID)
		if !commerce.ValidDiscountScopeType(s.ScopeType) {
			return ErrInvalidInput
		}
		switch s.ScopeType {
		case commerce.DiscountScopeAll:
			if s.ProductID != "" || s.ProductType != "" {
				return ErrInvalidInput
			}
		case commerce.DiscountScopeProduct:
			if s.ProductID == "" || s.ProductType != "" {
				return ErrInvalidInput
			}
		case commerce.DiscountScopeProductType:
			if s.ProductID != "" || !commerce.ValidProductType(s.ProductType) {
				return ErrInvalidInput
			}
		}
		k := string(s.ScopeType) + "|" + s.ProductID + "|" + string(s.ProductType)
		if _, ok := seen[k]; ok {
			continue
		}
		seen[k] = struct{}{}
		out = append(out, s)
	}
	w.Scopes = out
	return nil
}

func (s *CheckoutService) CatalogProduct(ctx context.Context, actor identity.User, id string) (commerce.Product, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return commerce.Product{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return commerce.Product{}, ErrInvalidInput
	}
	p, err := s.repo.GetProduct(ctx, id)
	if err != nil {
		return commerce.Product{}, err
	}
	if p.Status != commerce.ProductActive || !p.IsVisible {
		return commerce.Product{}, commerce.ErrNotFound
	}
	return p, nil
}

func (s *CheckoutService) PreviewDiscount(ctx context.Context, actor identity.User, productID, code string) (commerce.DiscountPreview, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return commerce.DiscountPreview{}, ErrForbidden
	}
	productID = strings.TrimSpace(productID)
	code = strings.ToUpper(strings.TrimSpace(code))
	if productID == "" || !discountCodePattern.MatchString(code) {
		return commerce.DiscountPreview{}, ErrInvalidInput
	}
	return s.repo.PreviewDiscount(ctx, productID, code)
}

func (s *CheckoutService) CreateCheckout(ctx context.Context, actor identity.User, in commerce.CheckoutCreate) (commerce.PaymentRequest, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return commerce.PaymentRequest{}, ErrForbidden
	}
	in.ProductID = strings.TrimSpace(in.ProductID)
	in.DiscountCode = strings.ToUpper(strings.TrimSpace(in.DiscountCode))
	in.IdempotencyKey = strings.TrimSpace(in.IdempotencyKey)
	if in.ProductID == "" || !commerce.ValidPaymentMethod(in.PaymentMethod) || in.IdempotencyKey == "" || len(in.IdempotencyKey) > 160 {
		return commerce.PaymentRequest{}, ErrInvalidInput
	}
	if in.DiscountCode != "" && !discountCodePattern.MatchString(in.DiscountCode) {
		return commerce.PaymentRequest{}, ErrInvalidInput
	}
	policy := s.policy
	if policy.GatewayMode == commerce.GatewayManualReview {
		policy.ProviderCode = "manual_" + string(in.PaymentMethod)
	}
	product, err := s.repo.GetProduct(ctx, in.ProductID)
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	revenue := commerce.RevenuePolicySnapshot{}
	if product.ProductType == commerce.ProductCourse {
		if s.revenue == nil {
			return commerce.PaymentRequest{}, commerce.ErrConflict
		}
		trainerID, percentage, eligible, resolveErr := s.revenue.CourseRevenuePolicy(ctx, product.CourseID)
		if resolveErr != nil {
			return commerce.PaymentRequest{}, resolveErr
		}
		if !eligible {
			return commerce.PaymentRequest{}, commerce.ErrConflict
		}
		revenue.CourseID = product.CourseID
		revenue.TrainerUserID = trainerID
		revenue.RevenueSharePercentage = percentage
	}
	request, err := s.repo.CreatePaymentRequest(ctx, actor.ID, in, policy, revenue)
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	if policy.GatewayMode != commerce.GatewayPaymentLink {
		return request, nil
	}
	if in.PaymentMethod != commerce.PaymentCard {
		return commerce.PaymentRequest{}, ErrInvalidInput
	}
	if request.Status != commerce.PaymentPending || request.ProviderSessionStatus == "initiated" {
		return request, nil
	}
	if s.initiator == nil {
		_, _ = s.repo.FailProviderSession(ctx, actor.ID, request.ID, request.Revision, "payment provider not configured")
		return commerce.PaymentRequest{}, ErrProviderUnavailable
	}
	session, initErr := s.initiator.Initiate(ctx, commerce.ProviderSessionInit{
		PaymentRequestID: request.ID,
		ProductID:        request.ProductID,
		UserID:           actor.ID,
		UserName:         actor.Name,
		UserEmail:        actor.Email,
		UserPhone:        actor.Phone,
		ProductName:      request.ProductName,
		AmountMinor:      request.FinalAmountMinor,
		Currency:         request.Currency,
	})
	if initErr != nil {
		_, _ = s.repo.FailProviderSession(ctx, actor.ID, request.ID, request.Revision, "provider session initiation failed")
		return commerce.PaymentRequest{}, ErrProviderUnavailable
	}
	session.SessionID = strings.TrimSpace(session.SessionID)
	session.RedirectURL = strings.TrimSpace(session.RedirectURL)
	if session.SessionID == "" || len(session.SessionID) > 180 || session.RedirectURL == "" || len(session.RedirectURL) > 2000 {
		_, _ = s.repo.FailProviderSession(ctx, actor.ID, request.ID, request.Revision, "provider returned invalid session")
		return commerce.PaymentRequest{}, ErrProviderUnavailable
	}
	return s.repo.AttachProviderSession(ctx, actor.ID, request.ID, request.Revision, session)
}

func (s *CheckoutService) MyRequests(ctx context.Context, actor identity.User, page, limit int) (commerce.PaymentRequestPage, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return commerce.PaymentRequestPage{}, ErrForbidden
	}
	var err error
	page, limit, err = normalizePage(page, limit, 20)
	if err != nil {
		return commerce.PaymentRequestPage{}, err
	}
	return s.repo.ListUserPaymentRequests(ctx, actor.ID, page, limit)
}

func (s *CheckoutService) ListDiscounts(ctx context.Context, actor identity.User, page, limit int, status commerce.DiscountStatus, search string) (commerce.DiscountPage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.DiscountPage{}, ErrForbidden
	}
	var err error
	page, limit, err = normalizePage(page, limit, 50)
	if err != nil {
		return commerce.DiscountPage{}, err
	}
	search = strings.TrimSpace(search)
	if len(search) > 100 || (status != "" && !commerce.ValidDiscountStatus(status)) {
		return commerce.DiscountPage{}, ErrInvalidInput
	}
	return s.repo.ListDiscounts(ctx, page, limit, status, search)
}

func (s *CheckoutService) CreateDiscount(ctx context.Context, actor identity.User, w commerce.DiscountWrite) (commerce.DiscountCode, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.DiscountCode{}, ErrForbidden
	}
	if err := normalizeDiscountWrite(&w); err != nil {
		return commerce.DiscountCode{}, err
	}
	for _, scope := range w.Scopes {
		if scope.ScopeType == commerce.DiscountScopeProduct {
			p, err := s.repo.GetProduct(ctx, scope.ProductID)
			if err != nil {
				return commerce.DiscountCode{}, err
			}
			if p.Status == commerce.ProductArchived {
				return commerce.DiscountCode{}, commerce.ErrConflict
			}
		}
	}
	return s.repo.CreateDiscount(ctx, actor.ID, w)
}

func (s *CheckoutService) UpdateDiscount(ctx context.Context, actor identity.User, id string, expected int, w commerce.DiscountWrite) (commerce.DiscountCode, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.DiscountCode{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	if id == "" || expected < 1 {
		return commerce.DiscountCode{}, ErrInvalidInput
	}
	if err := normalizeDiscountWrite(&w); err != nil {
		return commerce.DiscountCode{}, err
	}
	return s.repo.UpdateDiscount(ctx, actor.ID, id, expected, w)
}

func (s *CheckoutService) AdminRequests(ctx context.Context, actor identity.User, page, limit int, status commerce.PaymentStatus) (commerce.PaymentRequestPage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.PaymentRequestPage{}, ErrForbidden
	}
	var err error
	page, limit, err = normalizePage(page, limit, 50)
	if err != nil {
		return commerce.PaymentRequestPage{}, err
	}
	if status != "" && status != commerce.PaymentPending && status != commerce.PaymentPaid && status != commerce.PaymentRejected && status != commerce.PaymentCancelled && status != commerce.PaymentFailed {
		return commerce.PaymentRequestPage{}, ErrInvalidInput
	}
	return s.repo.ListAdminPaymentRequests(ctx, page, limit, status)
}

func (s *CheckoutService) Review(ctx context.Context, actor identity.User, id string, in commerce.PaymentReview) (commerce.PaymentRequest, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.PaymentRequest{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	in.ReviewerNotes = strings.TrimSpace(in.ReviewerNotes)
	in.ApprovalEvidence = strings.TrimSpace(in.ApprovalEvidence)
	if id == "" || in.ExpectedRevision < 1 || len(in.ReviewerNotes) > 1000 || len(in.ApprovalEvidence) > 1000 {
		return commerce.PaymentRequest{}, ErrInvalidInput
	}
	if in.Status != commerce.PaymentPaid && in.Status != commerce.PaymentRejected && in.Status != commerce.PaymentCancelled {
		return commerce.PaymentRequest{}, ErrInvalidInput
	}
	if in.Status == commerce.PaymentPaid && len(in.ApprovalEvidence) < 6 {
		return commerce.PaymentRequest{}, ErrInvalidInput
	}
	return s.repo.ReviewPaymentRequest(ctx, actor.ID, id, in)
}

func (s *CheckoutService) ProviderEvent(ctx context.Context, provider string, in commerce.ProviderEvent) (commerce.ProviderEventResult, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	in.EventID = strings.TrimSpace(in.EventID)
	in.PaymentRequestID = strings.TrimSpace(in.PaymentRequestID)
	in.Currency = strings.ToUpper(strings.TrimSpace(in.Currency))
	in.TransactionID = strings.TrimSpace(in.TransactionID)
	if !providerCodePattern.MatchString(provider) || in.EventID == "" || len(in.EventID) > 160 || in.PaymentRequestID == "" ||
		!commerce.ValidProviderEventStatus(in.Status) || len(in.TransactionID) > 180 || len(in.Currency) > 3 ||
		len(in.PayloadSHA256) != 64 {
		return commerce.ProviderEventResult{}, ErrInvalidInput
	}
	if in.Status == commerce.ProviderPaid && (in.AmountMinor == nil || *in.AmountMinor < 0 || len(in.Currency) != 3) {
		return commerce.ProviderEventResult{}, ErrInvalidInput
	}
	if in.OccurredAt != nil {
		now := time.Now().UTC()
		if in.OccurredAt.After(now.Add(24*time.Hour)) || in.OccurredAt.Before(now.AddDate(-2, 0, 0)) {
			return commerce.ProviderEventResult{}, ErrInvalidInput
		}
	}
	return s.repo.ApplyProviderEvent(ctx, provider, in)
}

func (s *CheckoutService) RevenueEntries(ctx context.Context, actor identity.User, page, limit int, allocation commerce.RevenueAllocationStatus, payout commerce.PayoutStatus) (commerce.RevenueEntryPage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.RevenueEntryPage{}, ErrForbidden
	}
	var err error
	page, limit, err = normalizePage(page, limit, 50)
	if err != nil {
		return commerce.RevenueEntryPage{}, err
	}
	if allocation != "" && allocation != commerce.RevenueNotApplicable && allocation != commerce.RevenuePolicyMissing && allocation != commerce.RevenuePending && allocation != commerce.RevenueAllocated {
		return commerce.RevenueEntryPage{}, ErrInvalidInput
	}
	if payout != "" && payout != commerce.PayoutNotApplicable && payout != commerce.PayoutPending && payout != commerce.PayoutPaid {
		return commerce.RevenueEntryPage{}, ErrInvalidInput
	}
	return s.repo.ListRevenueEntries(ctx, page, limit, allocation, payout)
}

func (s *CheckoutService) AllocateRevenue(ctx context.Context, actor identity.User, id string, in commerce.RevenueAllocation) (commerce.RevenueEntry, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.RevenueEntry{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	in.Evidence = strings.TrimSpace(in.Evidence)
	if id == "" || in.ExpectedRevision < 1 || in.ProviderFeeMinor < 0 || in.TrainerShareMinor < 0 || in.PlatformShareMinor < 0 || len(in.Evidence) < 6 || len(in.Evidence) > 2000 {
		return commerce.RevenueEntry{}, ErrInvalidInput
	}
	return s.repo.AllocateRevenue(ctx, actor.ID, id, in)
}

func (s *CheckoutService) MarkPayoutPaid(ctx context.Context, actor identity.User, id string, in commerce.PayoutMarkPaid) (commerce.RevenueEntry, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.RevenueEntry{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	in.Evidence = strings.TrimSpace(in.Evidence)
	if id == "" || in.ExpectedRevision < 1 || len(in.Evidence) < 6 || len(in.Evidence) > 2000 {
		return commerce.RevenueEntry{}, ErrInvalidInput
	}
	return s.repo.MarkPayoutPaid(ctx, actor.ID, id, in)
}
