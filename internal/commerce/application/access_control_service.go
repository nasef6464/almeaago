package application

import (
	"context"
	"strings"
	"time"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type AccessControlRepository interface {
	ListAccessCodes(context.Context, int, int, string, string, commerce.AccessCodeStatus) (commerce.AccessCodePage, error)
	CreateAccessCode(context.Context, string, commerce.AccessCodeWrite) (commerce.AccessCode, error)
	UpdateAccessCode(context.Context, string, string, commerce.AccessCodeUpdate) (commerce.AccessCode, error)
	RedeemAccessCode(context.Context, string, string, []string) (commerce.AccessCodeRedemption, error)
	ListSchoolSeats(context.Context, int, int, string, string, string) (commerce.SchoolSeatPage, error)
	AssignSchoolSeat(context.Context, string, commerce.SchoolSeatAssign) (commerce.SchoolSeat, commerce.Entitlement, error)
}

func (s *Service) accessControlRepo() (AccessControlRepository, error) {
	repo, ok := s.repo.(AccessControlRepository)
	if !ok {
		return nil, commerce.ErrConflict
	}
	return repo, nil
}

func (s *Service) ListAccessCodes(ctx context.Context, actor identity.User, page, limit int, schoolID, productID string, status commerce.AccessCodeStatus) (commerce.AccessCodePage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.AccessCodePage{}, ErrForbidden
	}
	var err error
	page, limit, err = normalizePage(page, limit, 50)
	if err != nil {
		return commerce.AccessCodePage{}, err
	}
	schoolID = strings.TrimSpace(schoolID)
	productID = strings.TrimSpace(productID)
	if status != "" && !commerce.ValidAccessCodeStatus(status) {
		return commerce.AccessCodePage{}, ErrInvalidInput
	}
	repo, err := s.accessControlRepo()
	if err != nil {
		return commerce.AccessCodePage{}, err
	}
	return repo.ListAccessCodes(ctx, page, limit, schoolID, productID, status)
}

func (s *Service) CreateAccessCode(ctx context.Context, actor identity.User, in commerce.AccessCodeWrite) (commerce.AccessCode, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.AccessCode{}, ErrForbidden
	}
	in.Code = strings.ToUpper(strings.TrimSpace(in.Code))
	in.SchoolID = strings.TrimSpace(in.SchoolID)
	in.ProductID = strings.TrimSpace(in.ProductID)
	now := time.Now().UTC()
	if !codePattern.MatchString(in.Code) || in.SchoolID == "" || in.ProductID == "" ||
		in.MaxUses < 1 || in.MaxUses > 1000000 || in.ExpiresAt.IsZero() || !in.ExpiresAt.After(now) ||
		(in.StartsAt != nil && !in.ExpiresAt.After(*in.StartsAt)) {
		return commerce.AccessCode{}, ErrInvalidInput
	}
	product, err := s.repo.GetProduct(ctx, in.ProductID)
	if err != nil {
		return commerce.AccessCode{}, err
	}
	if product.Status != commerce.ProductActive || !product.IsVisible || product.ProductType != commerce.ProductPackage ||
		product.Package == nil || product.Package.PackageKind != commerce.PackageSchool {
		return commerce.AccessCode{}, commerce.ErrConflict
	}
	repo, err := s.accessControlRepo()
	if err != nil {
		return commerce.AccessCode{}, err
	}
	return repo.CreateAccessCode(ctx, actor.ID, in)
}

func (s *Service) UpdateAccessCode(ctx context.Context, actor identity.User, id string, in commerce.AccessCodeUpdate) (commerce.AccessCode, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.AccessCode{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	if id == "" || in.ExpectedRevision < 1 || !commerce.ValidAccessCodeStatus(in.Status) ||
		in.MaxUses < 1 || in.MaxUses > 1000000 || in.ExpiresAt.IsZero() {
		return commerce.AccessCode{}, ErrInvalidInput
	}
	if in.Status == commerce.AccessCodeActive && !in.ExpiresAt.After(time.Now().UTC()) {
		return commerce.AccessCode{}, ErrInvalidInput
	}
	repo, err := s.accessControlRepo()
	if err != nil {
		return commerce.AccessCode{}, err
	}
	return repo.UpdateAccessCode(ctx, actor.ID, id, in)
}

func (s *Service) RedeemAccessCode(ctx context.Context, actor identity.User, code string) (commerce.AccessCodeRedemption, error) {
	if !actor.HasRole(identity.RoleStudent) || strings.TrimSpace(actor.ID) == "" {
		return commerce.AccessCodeRedemption{}, ErrForbidden
	}
	code = strings.ToUpper(strings.TrimSpace(code))
	if !codePattern.MatchString(code) {
		return commerce.AccessCodeRedemption{}, ErrInvalidInput
	}
	if s.schools == nil {
		return commerce.AccessCodeRedemption{}, commerce.ErrConflict
	}
	schoolIDs, err := s.schools.ActiveSchoolIDsForUser(ctx, actor.ID)
	if err != nil {
		return commerce.AccessCodeRedemption{}, err
	}
	if len(schoolIDs) == 0 {
		return commerce.AccessCodeRedemption{}, ErrForbidden
	}
	repo, err := s.accessControlRepo()
	if err != nil {
		return commerce.AccessCodeRedemption{}, err
	}
	return repo.RedeemAccessCode(ctx, actor.ID, code, schoolIDs)
}

func (s *Service) ListSchoolSeats(ctx context.Context, actor identity.User, page, limit int, schoolID, productID, userID string) (commerce.SchoolSeatPage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.SchoolSeatPage{}, ErrForbidden
	}
	var err error
	page, limit, err = normalizePage(page, limit, 50)
	if err != nil {
		return commerce.SchoolSeatPage{}, err
	}
	repo, err := s.accessControlRepo()
	if err != nil {
		return commerce.SchoolSeatPage{}, err
	}
	return repo.ListSchoolSeats(ctx, page, limit, strings.TrimSpace(schoolID), strings.TrimSpace(productID), strings.TrimSpace(userID))
}

func (s *Service) AssignSchoolSeat(ctx context.Context, actor identity.User, in commerce.SchoolSeatAssign) (commerce.SchoolSeat, commerce.Entitlement, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, ErrForbidden
	}
	in.SchoolID = strings.TrimSpace(in.SchoolID)
	in.ProductID = strings.TrimSpace(in.ProductID)
	in.UserID = strings.TrimSpace(in.UserID)
	in.IdempotencyKey = strings.TrimSpace(in.IdempotencyKey)
	if in.SchoolID == "" || in.ProductID == "" || in.UserID == "" || in.IdempotencyKey == "" || len(in.IdempotencyKey) > 160 {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, ErrInvalidInput
	}
	if in.ExpiresAt != nil && !in.ExpiresAt.After(time.Now().UTC()) {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, ErrInvalidInput
	}
	product, err := s.repo.GetProduct(ctx, in.ProductID)
	if err != nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, err
	}
	if product.Status != commerce.ProductActive || !product.IsVisible || product.ProductType != commerce.ProductPackage ||
		product.Package == nil || product.Package.PackageKind != commerce.PackageSchool {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, commerce.ErrConflict
	}
	if s.schools == nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, commerce.ErrConflict
	}
	schoolIDs, err := s.schools.ActiveSchoolIDsForUser(ctx, in.UserID)
	if err != nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, err
	}
	found := false
	for _, schoolID := range schoolIDs {
		if schoolID == in.SchoolID {
			found = true
			break
		}
	}
	if !found {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, ErrForbidden
	}
	repo, err := s.accessControlRepo()
	if err != nil {
		return commerce.SchoolSeat{}, commerce.Entitlement{}, err
	}
	return repo.AssignSchoolSeat(ctx, actor.ID, in)
}
