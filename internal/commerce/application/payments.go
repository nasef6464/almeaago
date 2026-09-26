package application

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"regexp"
	"strings"
	"time"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

var discountCodePattern = regexp.MustCompile(`^[A-Z0-9][A-Z0-9_-]{1,39}$`)

type PaymentRepository interface {
	GetCheckoutQuote(context.Context, string, string, string) (commerce.CheckoutQuote, error)
	CreatePaymentRequest(context.Context, string, commerce.PaymentRequestCreate, string, commerce.GatewayMode) (commerce.PaymentRequest, error)
	ListPaymentRequests(context.Context, int, int, commerce.PaymentStatus, string) (commerce.PaymentRequestPage, error)
	GetPaymentRequest(context.Context, string) (commerce.PaymentRequest, error)
	ReviewPaymentRequest(context.Context, string, string, commerce.PaymentReview) (commerce.PaymentRequest, error)
	ListDiscountCodes(context.Context, int, int, commerce.DiscountStatus, string) (commerce.DiscountPage, error)
	CreateDiscountCode(context.Context, string, commerce.DiscountWrite) (commerce.DiscountCode, error)
	UpdateDiscountCode(context.Context, string, string, int, commerce.DiscountWrite) (commerce.DiscountCode, error)
	ApplyProviderEvent(context.Context, commerce.ProviderEventInput) (commerce.ProviderEventResult, error)
}

func normalizeDiscountWrite(w *commerce.DiscountWrite) error {
	w.Code = strings.ToUpper(strings.TrimSpace(w.Code))
	w.Label = strings.TrimSpace(w.Label)
	w.Currency = strings.ToUpper(strings.TrimSpace(w.Currency))
	w.ProductID = strings.TrimSpace(w.ProductID)
	if !discountCodePattern.MatchString(w.Code) || len(w.Label) > 160 || !commerce.ValidDiscountType(w.Type) ||
		!commerce.ValidDiscountStatus(w.Status) || len(w.Currency) != 3 || w.Value <= 0 || w.MinAmountMinor < 0 ||
		w.MaxRedemptions < 0 {
		return ErrInvalidInput
	}
	if w.Type == commerce.DiscountPercentage && w.Value > 100 {
		return ErrInvalidInput
	}
	if w.ProductType != "" && !commerce.ValidProductType(w.ProductType) {
		return ErrInvalidInput
	}
	if w.StartsAt != nil && w.ExpiresAt != nil && !w.ExpiresAt.After(*w.StartsAt) {
		return ErrInvalidInput
	}
	return nil
}

func normalizePaymentCreate(in *commerce.PaymentRequestCreate) error {
	in.ProductID = strings.TrimSpace(in.ProductID)
	in.DiscountCode = strings.ToUpper(strings.TrimSpace(in.DiscountCode))
	in.PaymentCountry = strings.ToUpper(strings.TrimSpace(in.PaymentCountry))
	in.TransferReference = strings.TrimSpace(in.TransferReference)
	in.WalletNumber = strings.TrimSpace(in.WalletNumber)
	in.Notes = strings.TrimSpace(in.Notes)
	in.IdempotencyKey = strings.TrimSpace(in.IdempotencyKey)
	if in.ProductID == "" || !commerce.ValidPaymentMethod(in.PaymentMethod) || (in.PaymentCountry != "SA" && in.PaymentCountry != "EG") ||
		in.IdempotencyKey == "" || len(in.IdempotencyKey) > 160 || len(in.DiscountCode) > 40 ||
		len(in.TransferReference) > 180 || len(in.WalletNumber) > 80 || len(in.Notes) > 1000 {
		return ErrInvalidInput
	}
	if in.PaymentMethod == commerce.PaymentTransfer && in.TransferReference == "" && len(in.Notes) < 4 {
		return ErrInvalidInput
	}
	if in.PaymentMethod == commerce.PaymentWallet && in.WalletNumber == "" && len(in.Notes) < 4 {
		return ErrInvalidInput
	}
	return nil
}

func (s *Service) paymentRepository() (PaymentRepository, error) {
	if s.payments == nil {
		return nil, commerce.ErrConflict
	}
	return s.payments, nil
}

func (s *Service) CheckoutQuote(ctx context.Context, actor identity.User, productID, discountCode string) (commerce.CheckoutQuote, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return commerce.CheckoutQuote{}, ErrForbidden
	}
	repo, err := s.paymentRepository()
	if err != nil {
		return commerce.CheckoutQuote{}, err
	}
	productID = strings.TrimSpace(productID)
	discountCode = strings.ToUpper(strings.TrimSpace(discountCode))
	if productID == "" || len(discountCode) > 40 {
		return commerce.CheckoutQuote{}, ErrInvalidInput
	}
	quote, err := repo.GetCheckoutQuote(ctx, actor.ID, productID, discountCode)
	if err != nil {
		return commerce.CheckoutQuote{}, err
	}
	if quote.CourseID != "" {
		decision, accessErr := s.CourseAccess(ctx, actor, quote.CourseID)
		if accessErr != nil {
			return commerce.CheckoutQuote{}, accessErr
		}
		if decision.Allowed {
			return commerce.CheckoutQuote{}, commerce.ErrConflict
		}
	}
	return quote, nil
}

func (s *Service) CreatePaymentRequest(ctx context.Context, actor identity.User, in commerce.PaymentRequestCreate) (commerce.PaymentRequest, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return commerce.PaymentRequest{}, ErrForbidden
	}
	if err := normalizePaymentCreate(&in); err != nil {
		return commerce.PaymentRequest{}, err
	}
	repo, err := s.paymentRepository()
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	quote, err := s.CheckoutQuote(ctx, actor, in.ProductID, in.DiscountCode)
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	providerCode := string(in.PaymentMethod)
	mode := commerce.GatewayManualReview
	if in.PaymentMethod == commerce.PaymentCard && s.webhookSecret != "" && quote.FinalAmountMinor > 0 {
		mode = commerce.GatewayWebhook
	}
	return repo.CreatePaymentRequest(ctx, actor.ID, in, providerCode, mode)
}

func (s *Service) MyPaymentRequests(ctx context.Context, actor identity.User, page, limit int) (commerce.PaymentRequestPage, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return commerce.PaymentRequestPage{}, ErrForbidden
	}
	repo, err := s.paymentRepository()
	if err != nil {
		return commerce.PaymentRequestPage{}, err
	}
	page, limit, err = normalizePage(page, limit, 20)
	if err != nil {
		return commerce.PaymentRequestPage{}, err
	}
	return repo.ListPaymentRequests(ctx, page, limit, "", actor.ID)
}

func (s *Service) ListPaymentRequests(ctx context.Context, actor identity.User, page, limit int, status commerce.PaymentStatus) (commerce.PaymentRequestPage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.PaymentRequestPage{}, ErrForbidden
	}
	repo, err := s.paymentRepository()
	if err != nil {
		return commerce.PaymentRequestPage{}, err
	}
	page, limit, err = normalizePage(page, limit, 50)
	if err != nil {
		return commerce.PaymentRequestPage{}, err
	}
	if status != "" && !commerce.ValidPaymentStatus(status) {
		return commerce.PaymentRequestPage{}, ErrInvalidInput
	}
	return repo.ListPaymentRequests(ctx, page, limit, status, "")
}

func (s *Service) ReviewPaymentRequest(ctx context.Context, actor identity.User, id string, review commerce.PaymentReview) (commerce.PaymentRequest, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.PaymentRequest{}, ErrForbidden
	}
	repo, err := s.paymentRepository()
	if err != nil {
		return commerce.PaymentRequest{}, err
	}
	id = strings.TrimSpace(id)
	review.ReviewerNotes = strings.TrimSpace(review.ReviewerNotes)
	review.ApprovalEvidence = strings.TrimSpace(review.ApprovalEvidence)
	if id == "" || review.ExpectedRevision < 1 || !commerce.ValidReviewTarget(review.Status) ||
		len(review.ReviewerNotes) > 1000 || len(review.ApprovalEvidence) > 500 ||
		(review.Status == commerce.PaymentApproved && len(review.ApprovalEvidence) < 6) {
		return commerce.PaymentRequest{}, ErrInvalidInput
	}
	return repo.ReviewPaymentRequest(ctx, actor.ID, id, review)
}

func (s *Service) ListDiscountCodes(ctx context.Context, actor identity.User, page, limit int, status commerce.DiscountStatus, search string) (commerce.DiscountPage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.DiscountPage{}, ErrForbidden
	}
	repo, err := s.paymentRepository()
	if err != nil {
		return commerce.DiscountPage{}, err
	}
	page, limit, err = normalizePage(page, limit, 50)
	if err != nil {
		return commerce.DiscountPage{}, err
	}
	search = strings.ToUpper(strings.TrimSpace(search))
	if len(search) > 80 || (status != "" && !commerce.ValidDiscountStatus(status)) {
		return commerce.DiscountPage{}, ErrInvalidInput
	}
	return repo.ListDiscountCodes(ctx, page, limit, status, search)
}

func (s *Service) CreateDiscountCode(ctx context.Context, actor identity.User, w commerce.DiscountWrite) (commerce.DiscountCode, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.DiscountCode{}, ErrForbidden
	}
	repo, err := s.paymentRepository()
	if err != nil {
		return commerce.DiscountCode{}, err
	}
	if err = normalizeDiscountWrite(&w); err != nil {
		return commerce.DiscountCode{}, err
	}
	if w.ProductID != "" {
		product, productErr := s.repo.GetProduct(ctx, w.ProductID)
		if productErr != nil {
			return commerce.DiscountCode{}, productErr
		}
		if w.ProductType != "" && product.ProductType != w.ProductType {
			return commerce.DiscountCode{}, commerce.ErrConflict
		}
	}
	return repo.CreateDiscountCode(ctx, actor.ID, w)
}

func (s *Service) UpdateDiscountCode(ctx context.Context, actor identity.User, id string, expectedRevision int, w commerce.DiscountWrite) (commerce.DiscountCode, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.DiscountCode{}, ErrForbidden
	}
	repo, err := s.paymentRepository()
	if err != nil {
		return commerce.DiscountCode{}, err
	}
	id = strings.TrimSpace(id)
	if id == "" || expectedRevision < 1 {
		return commerce.DiscountCode{}, ErrInvalidInput
	}
	if err = normalizeDiscountWrite(&w); err != nil {
		return commerce.DiscountCode{}, err
	}
	if w.ProductID != "" {
		product, productErr := s.repo.GetProduct(ctx, w.ProductID)
		if productErr != nil {
			return commerce.DiscountCode{}, productErr
		}
		if w.ProductType != "" && product.ProductType != w.ProductType {
			return commerce.DiscountCode{}, commerce.ErrConflict
		}
	}
	return repo.UpdateDiscountCode(ctx, actor.ID, id, expectedRevision, w)
}

func verifyProviderSignature(secret string, raw []byte, signature string) bool {
	secret = strings.TrimSpace(secret)
	signature = strings.TrimSpace(strings.TrimPrefix(signature, "sha256="))
	if secret == "" || signature == "" {
		return false
	}
	provided, err := hex.DecodeString(signature)
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(raw)
	expected := mac.Sum(nil)
	return len(provided) == len(expected) && subtle.ConstantTimeCompare(provided, expected) == 1
}

func (s *Service) ApplyProviderEvent(ctx context.Context, raw []byte, signature string, in commerce.ProviderEventInput) (commerce.ProviderEventResult, error) {
	if s.webhookSecret == "" {
		return commerce.ProviderEventResult{}, ErrProviderUnavailable
	}
	if !verifyProviderSignature(s.webhookSecret, raw, signature) {
		return commerce.ProviderEventResult{}, ErrForbidden
	}
	in.ProviderCode = strings.TrimSpace(in.ProviderCode)
	in.EventID = strings.TrimSpace(in.EventID)
	in.PaymentRequestID = strings.TrimSpace(in.PaymentRequestID)
	in.Currency = strings.ToUpper(strings.TrimSpace(in.Currency))
	in.TransactionID = strings.TrimSpace(in.TransactionID)
	if in.ProviderCode == "" || len(in.ProviderCode) > 80 || in.EventID == "" || len(in.EventID) > 160 ||
		in.PaymentRequestID == "" || !commerce.ValidProviderEventStatus(in.Status) || in.AmountMinor < 0 ||
		len(in.Currency) != 3 || len(in.TransactionID) > 180 {
		return commerce.ProviderEventResult{}, ErrInvalidInput
	}
	sum := sha256.Sum256(raw)
	in.PayloadSHA256 = hex.EncodeToString(sum[:])
	if in.OccurredAt == nil {
		now := time.Now().UTC()
		in.OccurredAt = &now
	}
	repo, err := s.paymentRepository()
	if err != nil {
		return commerce.ProviderEventResult{}, err
	}
	return repo.ApplyProviderEvent(ctx, in)
}
